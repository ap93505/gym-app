import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { MemoryFirestore } from "./support/memoryFirestore";
import { DEFAULT_COACH_ID } from "../src/lib/domain/cooperatingCoaches";
import type { SessionPrincipal } from "../src/lib/domain/types";

const memory = new MemoryFirestore();
(globalThis as typeof globalThis & { __rayFirestore?: Firestore }).__rayFirestore = memory as unknown as Firestore;
const services = Promise.all([
  import("../src/lib/services/users"), import("../src/lib/services/cooperatingCoaches"),
  import("../src/lib/services/sessions"), import("../src/lib/services/lineUsers"),
]);
const admin: SessionPrincipal = { userId: "admin", displayName: "管理員", roles: ["admin"] };
const student: SessionPrincipal = { userId: "A", displayName: "A", roles: ["student"] };
const coach: SessionPrincipal = { userId: "coach", displayName: "教練", roles: ["coach"] };
const ray: SessionPrincipal = { ...coach, userId: DEFAULT_COACH_ID };
const startAt = new Date(Date.now() + 2 * 86400000);
startAt.setUTCHours(2, 0, 0, 0);
const input = (studentId = "A", coachId = "coach", at = startAt) => ({ studentId, coachId, planId: "plan", startAt: at, recurrence: { frequency: "none" as const } });

beforeEach(() => {
  memory.reset();
  for (const id of ["A", "B", "coach", DEFAULT_COACH_ID, "admin"]) memory.seed(`users/${id}`, {
    displayName: id, roles: id === "admin" ? ["admin"] : ["coach", DEFAULT_COACH_ID].includes(id) ? ["coach"] : ["student"],
    status: "active", credits: { totalRemaining: 0, reserved: 0 },
  });
  memory.seed("plans/plan", { name: "私人教練", active: true, sessions: 10 });
});

test("舊會員預設 Ray；教練無法以省略或變更 role 取得未配合學員，admin 可見全部", async () => {
  const [users, coaches] = await services;
  assert.deepEqual((await users.getUser("A")).cooperatingCoachIds, [DEFAULT_COACH_ID]);
  assert.deepEqual((await users.listUsers(ray, "student")).map((u) => u.id), ["A", "B"]);
  for (const role of [undefined, "student", "coach", "admin"] as const) assert.deepEqual(await users.listUsers(coach, role), []);
  await coaches.updateCooperatingCoaches(student, "A", ["coach"]);
  assert.deepEqual((await users.listUsers(coach)).map((u) => u.id), ["A"]);
  assert.deepEqual((await users.listUsers(ray)).map((u) => u.id), ["B"]);
  assert.equal((await users.listUsers(admin)).length, 5);
  await assert.rejects(users.listUsers(student), /沒有權限/);
});

test("學員只可維護自己，admin 可維護任何學員，至少一位有效教練並保留異動紀錄", async () => {
  const [, coaches] = await services;
  await assert.rejects(coaches.updateCooperatingCoaches(student, "B", ["coach"]), /只有學員本人/);
  await assert.rejects(coaches.updateCooperatingCoaches(coach, "A", ["coach"]), /只有學員本人/);
  for (const ids of [[], ["missing"], ["A"], ["bad/path"], Array(51).fill("coach")]) {
    await assert.rejects(coaches.updateCooperatingCoaches(student, "A", ids));
  }
  memory.seed("users/disabled", { roles: ["coach"], status: "disabled" });
  await assert.rejects(coaches.updateCooperatingCoaches(admin, "A", ["disabled"]), /有效且未停用/);
  assert.equal((await coaches.listCoaches()).some((c) => c.id === "disabled"), false);
  assert.deepEqual(await coaches.updateCooperatingCoaches(student, "A", ["coach", "coach", DEFAULT_COACH_ID]), ["coach", DEFAULT_COACH_ID]);
  await coaches.updateCooperatingCoaches(admin, "B", ["coach"]);
  const audits = [...memory.rows.values()].filter((d) => d.action === "user.cooperating_coaches_updated");
  assert.equal(audits.length, 2);
  assert.deepEqual(audits[0].metadata, { before: [DEFAULT_COACH_ID], after: ["coach", DEFAULT_COACH_ID] });
});

test("新帳號預設 Ray；再次登入不覆寫配合教練、角色或餘額，舊帳號補入預設值", async () => {
  const [users, coaches, , login] = await services;
  await login.upsertLineUser({ sub: "new", name: "新會員" });
  assert.deepEqual(memory.rows.get("users/new")?.cooperatingCoachIds, [DEFAULT_COACH_ID]);
  await coaches.updateCooperatingCoaches(student, "A", ["coach"]);
  await Promise.all([users.grantPlanCredits("admin", "A", "plan"), login.upsertLineUser({ sub: "A", name: "更新名字" })]);
  assert.deepEqual(memory.rows.get("users/A")?.cooperatingCoachIds, ["coach"]);
  assert.deepEqual(memory.rows.get("users/A")?.credits, { totalRemaining: 10, reserved: 0 });
  assert.deepEqual(memory.rows.get("users/A")?.roles, ["student"]);
  assert.equal(memory.rows.get("users/A")?.displayName, "更新名字");
  await login.upsertLineUser({ sub: "B" });
  assert.deepEqual(memory.rows.get("users/B")?.cooperatingCoachIds, [DEFAULT_COACH_ID]);
});

test("教練只能為配合學員排課，不能指定別的教練繞過；admin 不受配合關係限制", async () => {
  const [users, coaches, sessions] = await services;
  await users.grantPlanCredits("admin", "A", "plan");
  await assert.rejects(sessions.createSessions(coach, input()), /未將你設為配合教練/);
  await assert.rejects(sessions.createSessions(coach, input("A", DEFAULT_COACH_ID)), /權限|教練/);
  assert.equal([...memory.rows.keys()].some((p) => p.startsWith("sessions/")), false);
  await sessions.createSessions(admin, input());
  await coaches.updateCooperatingCoaches(student, "A", ["coach"]);
  await sessions.createSessions(coach, input("A", "coach", new Date(startAt.getTime() + 3600000)));
  await sessions.createSessions(admin, input("A", DEFAULT_COACH_ID, new Date(startAt.getTime() + 7200000)));
});

test("共用方案不授予教練排課權限，改課也檢查新學員的配合關係", async () => {
  const [users, coaches, sessions] = await services;
  await users.grantPlanCredits("admin", "A", "plan", ["B"]);
  await coaches.updateCooperatingCoaches(student, "A", ["coach"]);
  const { sessionIds } = await sessions.createSessions(coach, input());
  await assert.rejects(sessions.createSessions(coach, input("B")), /未將你設為配合教練/);
  await assert.rejects(sessions.updateSession(coach, sessionIds[0], input("B")), /未將你設為配合教練/);
  assert.equal(memory.rows.get(`sessions/${sessionIds[0]}`)?.studentId, "A");
  await sessions.updateSession(admin, sessionIds[0], input("B"));
});

test("移除配合教練保留原課程及確認權限，但拒絕教練新增或改期", async () => {
  const [users, coaches, sessions] = await services;
  await users.grantPlanCredits("admin", "A", "plan");
  await coaches.updateCooperatingCoaches(student, "A", ["coach"]);
  const past = await sessions.createSessions(admin, input("A", "coach", new Date("2025-01-01T02:00:00Z")));
  const future = await sessions.createSessions(coach, input());
  await coaches.updateCooperatingCoaches(student, "A", [DEFAULT_COACH_ID]);
  assert.equal(memory.rows.get(`sessions/${future.sessionIds[0]}`)?.coachId, "coach");
  await assert.rejects(sessions.updateSession(coach, future.sessionIds[0], input()), /未將你設為配合教練/);
  await coaches.updateCooperatingCoaches(admin, "B", ["coach"]);
  await users.grantPlanCredits("admin", "B", "plan");
  await assert.rejects(sessions.updateSession(coach, future.sessionIds[0], input("B")), /未將你設為配合教練/);
  await assert.rejects(sessions.createSessions(coach, input()), /未將你設為配合教練/);
  await sessions.checkIn(admin, past.sessionIds[0], "A");
  await sessions.confirmOutcome(coach, past.sessionIds[0], "completed");
  assert.equal((await users.getUser("A")).credits.totalRemaining, 9);
});

test("停用學員不列入教練選單，停用帳號即使 admin 也不能排課", async () => {
  const [users, , sessions] = await services;
  await users.grantPlanCredits("admin", "A", "plan");
  memory.seed("users/A", { ...memory.rows.get("users/A")!, status: "disabled" });
  assert.deepEqual((await users.listUsers(ray)).map((u) => u.id), ["B"]);
  await assert.rejects(sessions.createSessions(admin, input()), /停用/);
});

test("配合關係在排課交易提交前被移除，重試會拒絕排課而不留下預約或扣堂", async () => {
  const [users, coaches, sessions] = await services;
  await users.grantPlanCredits("admin", "A", "plan");
  await coaches.updateCooperatingCoaches(student, "A", ["coach"]);
  const runTransaction = memory.runTransaction.bind(memory);
  let removed = false;
  memory.runTransaction = (callback) => runTransaction(async (tx) => {
    const result = await callback(tx);
    if (!removed) {
      removed = true;
      memory.seed("users/A", { ...memory.rows.get("users/A")!, cooperatingCoachIds: [DEFAULT_COACH_ID] });
    }
    return result;
  });
  try { await assert.rejects(sessions.createSessions(coach, input()), /未將你設為配合教練/); }
  finally { memory.runTransaction = runTransaction; }
  assert.ok(memory.retries > 0);
  assert.equal([...memory.rows.keys()].some((p) => p.startsWith("sessions/")), false);
  assert.deepEqual(memory.rows.get("users/A")?.credits, { totalRemaining: 10, reserved: 0 });
});
