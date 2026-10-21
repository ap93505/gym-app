import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { MemoryFirestore } from "./support/memoryFirestore";
import { summarizeBatches, voidBlockedReason } from "../src/lib/domain/creditBatches";
import type { SessionPrincipal } from "../src/lib/domain/types";

const memory = new MemoryFirestore();
(globalThis as typeof globalThis & { __rayFirestore?: Firestore }).__rayFirestore = memory as unknown as Firestore;
const services = Promise.all([
  import("../src/lib/services/users"),
  import("../src/lib/services/sessions"),
  import("../src/lib/services/creditBatches"),
]);
const admin: SessionPrincipal = { userId: "admin", displayName: "管理員", roles: ["admin"] };
const student: SessionPrincipal = { userId: "B", displayName: "B", roles: ["student"] };
const coach: SessionPrincipal = { userId: "coach", displayName: "教練", roles: ["coach"] };
const startAt = new Date("2025-01-01T02:00:00Z"); // Admin can create past sessions for outcome tests.
const input = (studentId = "A", at = startAt) => ({ studentId, coachId: "coach", planId: "plan", startAt: at, recurrence: { frequency: "none" as const } });

beforeEach(() => {
  memory.reset();
  for (const id of ["A", "B", "C", "coach", "admin"]) memory.seed(`users/${id}`, {
    displayName: id, roles: id === "coach" ? ["coach"] : id === "admin" ? ["admin"] : ["student"],
    status: "active", credits: { totalRemaining: 0, reserved: 0 },
  });
  memory.seed("plans/plan", { name: "1對1", active: true, sessions: 24 });
});

async function grant(quantity = 24, shared = true) {
  const [users, , credits] = await services;
  await users.grantCredits("admin", "A", quantity, "plan", "1對1", "", shared ? ["B"] : []);
  return (await credits.listCreditBatches(admin, "A"))[0];
}

test("共用 24 堂只有一筆餘額；A、B 完成與取消同步顯示，流水保留上課人", async () => {
  const [users, sessions] = await services;
  const batch = await grant();
  assert.equal((await users.getUser("A")).credits.sharedRemaining, 24);
  assert.equal((await users.getUser("B")).credits.sharedRemaining, 24);
  assert.equal((await users.getUser("C")).credits.totalRemaining, 0);
  const a = await sessions.createSessions(admin, input("A"));
  const b = await sessions.createSessions(admin, input("B", new Date(startAt.getTime() + 3600000)));
  assert.equal((await users.getUser("A")).credits.available, 22);
  assert.equal((await users.getUser("B")).credits.reserved, 2);
  await sessions.checkIn(admin, b.sessionIds[0], "B");
  await sessions.confirmOutcome(admin, b.sessionIds[0], "completed");
  await sessions.cancelSession(admin, a.sessionIds[0], "改期");
  for (const id of ["A", "B"]) {
    const credits = (await users.getUser(id)).credits;
    assert.equal(credits.totalRemaining, 23); assert.equal(credits.reserved, 0);
  }
  assert.equal(memory.rows.get(`users/A/creditBatches/${batch.id}`)?.remainingUnits, 23);
  const consume = [...memory.rows.entries()].find(([path, data]) => path.startsWith("creditLedgers/") && data.type === "consume")![1];
  assert.equal(consume.userId, "B"); assert.equal(consume.creditOwnerId, "A");
  assert.deepEqual(memory.rows.get("users/A")?.credits, { totalRemaining: 23, reserved: 0 });
  assert.deepEqual(memory.rows.get("users/B")?.credits, { totalRemaining: 0, reserved: 0 });
});

test("最後一堂已占用時可改為共用會員上課，不重複占堂", async () => {
  const [users, sessions] = await services;
  await grant(1);
  const created = await sessions.createSessions(admin, input());
  await sessions.updateSession(admin, created.sessionIds[0], input("B"));
  assert.equal((await users.getUser("B")).credits.reserved, 1);
  assert.equal(memory.rows.get(`sessions/${created.sessionIds[0]}`)?.creditOwnerId, "A");
  await sessions.cancelSession(admin, created.sessionIds[0], "取消");
  assert.equal((await users.getUser("A")).credits.available, 1);
});

test("同時爭取最後一堂只有一人成功，失敗預約不留課程或鎖", async () => {
  const [, sessions] = await services;
  await grant(1);
  const results = await Promise.allSettled([
    sessions.createSessions(admin, input()),
    sessions.createSessions(admin, input("B", new Date(startAt.getTime() + 3600000))),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal([...memory.rows.keys()].filter((path) => path.startsWith("sessions/")).length, 1);
  assert.equal([...memory.rows.keys()].filter((path) => path.startsWith("studentSlotLocks/")).length, 1);
  assert.ok(memory.retries > 0);
});

test("整筆未使用共用儲值可作廢一次，所有人餘額歸零且保留紀錄", async () => {
  const [users, sessions, credits] = await services;
  const batch = await grant();
  await credits.voidCreditBatch(admin, "A", batch.id, "重複儲值");
  assert.equal((await users.getUser("A")).credits.available, 0);
  assert.equal((await users.getUser("B")).credits.available, 0);
  assert.equal((await credits.listCreditBatches(admin, "B"))[0].status, "voided");
  await assert.rejects(credits.voidCreditBatch(admin, "A", batch.id, "再按一次"), /已作廢/);
  await assert.rejects(sessions.createSessions(admin, input("B")), /堂數不足/);
  assert.equal([...memory.rows.values()].filter((row) => row.type === "void").length, 1);
});

test("預約與作廢同時發生只能有一方成功", async () => {
  const [, sessions, credits] = await services;
  const batch = await grant(1);
  const results = await Promise.allSettled([
    sessions.createSessions(admin, input("B")),
    credits.voidCreditBatch(admin, "A", batch.id, "誤儲值"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const data = memory.rows.get(`users/A/creditBatches/${batch.id}`)!;
  assert.ok(data.status === "voided" ? data.reservedUnits === 0 : data.reservedUnits === 1);
});

test("曾預約後取消、未完成、改用其他方案都不能作廢原儲值", async () => {
  const [users, sessions, credits] = await services;
  const batch = await grant(3);
  const cancelled = await sessions.createSessions(admin, input());
  await sessions.cancelSession(admin, cancelled.sessionIds[0], "取消");
  await assert.rejects(credits.voidCreditBatch(admin, "A", batch.id, "刪除"), /曾被預約/);
  const incomplete = await sessions.createSessions(admin, input());
  await sessions.confirmOutcome(admin, incomplete.sessionIds[0], "not_completed", "student_no_show", "未出席");
  await assert.rejects(credits.voidCreditBatch(admin, "A", batch.id, "刪除"), /曾被預約/);
  await users.grantCredits("admin", "B", 2, "other", "其他方案");
  const created = await sessions.createSessions(admin, input("B", new Date(startAt.getTime() + 3600000)));
  await sessions.updateSession(admin, created.sessionIds[0], { ...input("B", new Date(startAt.getTime() + 3600000)), planId: "other" });
  assert.equal(memory.rows.get(`users/A/creditBatches/${batch.id}`)?.reservedUnits, 0);
  await assert.rejects(credits.voidCreditBatch(admin, "A", batch.id, "刪除"), /曾被預約/);
});

test("既有單人儲值可加入共用，舊預約仍能扣堂；加入重複會員不重複計數", async () => {
  const [users, sessions, credits] = await services;
  const batch = await grant(2, false);
  const created = await sessions.createSessions(admin, input());
  const ref = `users/A/creditBatches/${batch.id}`;
  const legacy = { ...memory.rows.get(ref)! };
  delete legacy.memberIds; delete legacy.hasBeenReserved; delete legacy.status;
  memory.seed(ref, legacy);
  const oldSession = { ...memory.rows.get(`sessions/${created.sessionIds[0]}`)! };
  delete oldSession.creditOwnerId;
  memory.seed(`sessions/${created.sessionIds[0]}`, oldSession);
  await credits.addBatchMember(admin, "A", batch.id, "B");
  await credits.addBatchMember(admin, "A", batch.id, "B");
  assert.equal((await users.getUser("B")).credits.totalRemaining, 2);
  await sessions.checkIn(admin, created.sessionIds[0], "A");
  await sessions.confirmOutcome(admin, created.sessionIds[0], "completed");
  assert.equal((await users.getUser("B")).credits.available, 1);
});

test("循環預約可跨個人和共用批次分配，不足時整批失敗", async () => {
  const [users, sessions] = await services;
  await grant(2);
  await users.grantCredits("admin", "B", 1, "plan", "1對1");
  await assert.rejects(sessions.createSessions(admin, { ...input("B"), recurrence: { frequency: "daily", count: 4 } }), /堂數不足/);
  assert.equal([...memory.rows.keys()].filter((path) => path.startsWith("sessions/")).length, 0);
  const created = await sessions.createSessions(admin, { ...input("B"), recurrence: { frequency: "daily", count: 3 } });
  assert.equal(created.count, 3);
  assert.equal((await users.getUser("B")).credits.available, 0);
  for (const id of created.sessionIds) await sessions.cancelSession(admin, id, "取消");
  assert.equal((await users.getUser("B")).credits.available, 3);
  assert.equal((await users.getUser("A")).credits.available, 2);
});

test("共用不開放代打卡或查看他人課程，也不開放學生或教練管理儲值", async () => {
  const [, sessions, credits] = await services;
  const batch = await grant();
  const created = await sessions.createSessions(admin, input());
  await assert.rejects(sessions.checkIn(student, created.sessionIds[0]), /不屬於/);
  assert.deepEqual(await sessions.listSessions(startAt, new Date(startAt.getTime() + 86400000), student), []);
  for (const principal of [student, coach]) {
    await assert.rejects(credits.addBatchMember(principal, "A", batch.id, "C"), /只有管理者/);
    await assert.rejects(credits.voidCreditBatch(principal, "A", batch.id, "刪除"), /只有管理者/);
    await assert.rejects(credits.listCreditBatches(principal, "A"), /只有管理者/);
  }
  await assert.rejects(credits.addBatchMember(admin, "A", batch.id, "coach"), /有效的學生/);
});

test("過期、作廢與未授權共用索引不提供可用堂數", async () => {
  const [users, sessions] = await services;
  const batch = await grant();
  memory.seed("users/C", { ...memory.rows.get("users/C")!, sharedCreditBatchPaths: [`users/A/creditBatches/${batch.id}`] });
  assert.equal((await users.getUser("C")).credits.available, 0);
  await assert.rejects(sessions.createSessions(admin, input("C")), /堂數不足/);
  const path = `users/A/creditBatches/${batch.id}`;
  memory.seed(path, { ...memory.rows.get(path)!, expiresAt: Timestamp.fromMillis(1) });
  assert.equal((await users.getUser("B")).credits.available, 0);
  await assert.rejects(sessions.createSessions(admin, input("B")), /堂數不足/);
});

test("作廢規則拒絕舊歷程不明、已消耗或已占用的批次", () => {
  const base = { originalUnits: 24, remainingUnits: 24, reservedUnits: 0, hasBeenReserved: false };
  assert.equal(voidBlockedReason(base), null);
  assert.match(voidBlockedReason({ ...base, hasBeenReserved: undefined })!, /舊儲值/);
  assert.match(voidBlockedReason({ ...base, remainingUnits: 23 })!, /已有使用/);
  assert.match(voidBlockedReason({ ...base, reservedUnits: 1 })!, /已有預約/);
});

test("個人與共用方案分類正確，不納入作廢或過期堂數", () => {
  const base = { planId: "p", planName: "方案", remainingUnits: 10, reservedUnits: 2, expiresAt: 100, shared: false };
  const result = summarizeBatches([base, { ...base, shared: true }, { ...base, status: "voided" }, { ...base, expiresAt: 1 }], 50);
  assert.equal(result.totalRemaining, 20);
  assert.equal(result.available, 16);
  assert.equal(result.personalRemaining, 10);
  assert.equal(result.sharedRemaining, 10);
  assert.equal(result.plans.length, 1);
});
