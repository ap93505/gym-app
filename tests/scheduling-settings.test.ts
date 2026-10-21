import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { MemoryFirestore } from "./support/memoryFirestore";
import { AppError } from "../src/lib/domain/errors";
import { slotCapacityState } from "../src/lib/domain/scheduling";
import type { SessionPrincipal } from "../src/lib/domain/types";

const memory = new MemoryFirestore();
(globalThis as typeof globalThis & { __rayFirestore?: Firestore }).__rayFirestore = memory as unknown as Firestore;
const services = Promise.all([import("../src/lib/services/sessions"), import("../src/lib/services/settings")]);
const admin: SessionPrincipal = { userId: "admin", displayName: "管理員", roles: ["admin"] };
const startAt = new Date("2025-01-01T02:00:00Z");
const input = (index: number, start = startAt) => ({ studentId: `student${index}`, coachId: `coach${index}`, planId: "plan", startAt: start, recurrence: { frequency: "none" as const } });

const capacityConflict = (capacity: number) => (error: unknown) => error instanceof AppError && error.code === "SCHEDULE_CONFLICT" && Array.isArray(error.details) && error.details.some((detail) => String(detail).includes(`${capacity} 堂上限`));

beforeEach(() => {
  memory.reset();
  for (let i = 1; i <= 6; i++) {
    memory.seed(`users/student${i}`, { roles: ["student"], displayName: `學生${i}`, credits: { totalRemaining: 5, reserved: 0 } });
    memory.seed(`users/coach${i}`, { roles: ["coach"], displayName: `教練${i}` });
    memory.seed(`users/student${i}/creditBatches/batch`, {
      planId: "plan", planName: "測試", originalUnits: 5, remainingUnits: 5, reservedUnits: 0,
      expiresAt: Timestamp.fromDate(new Date("2099-01-01")),
    });
  }
});

test("無設定時預設 4 堂，第四堂成功、第五堂拒絕；提高上限後可再預約", async () => {
  const [sessions, settings] = await services;
  assert.equal((await settings.getSchedulingSettings()).slotCapacity, 4);
  for (let i = 1; i <= 4; i++) await sessions.createSessions(admin, input(i));
  await assert.rejects(sessions.createSessions(admin, input(5)), capacityConflict(4));
  assert.equal((memory.rows.get("users/student5")?.credits as { reserved: number }).reserved, 0);
  await settings.updateSchedulingSettings(admin, 5);
  await sessions.createSessions(admin, input(5));
  assert.equal(memory.rows.get(`timeSlots/${startAt.getTime()}`)?.count, 5);
});

test("容量 API 在空行事曆也回傳設定，已有時段使用相同上限", async () => {
  const [sessions, settings] = await services;
  await settings.updateSchedulingSettings(admin, 7);
  const to = new Date(startAt.getTime() + 86400000);
  assert.deepEqual(await sessions.listSlotAvailability(startAt, to), { slotCapacity: 7, slots: [] });
  await sessions.createSessions(admin, input(1));
  assert.equal((await sessions.listSlotAvailability(startAt, to)).slots[0].capacity, 7);
});

test("調低上限保留原課程及原時段編輯，但拒絕新增或移入；空出名額後恢復", async () => {
  const [sessions, settings] = await services;
  const ids: string[] = [];
  for (let i = 1; i <= 4; i++) ids.push((await sessions.createSessions(admin, input(i))).sessionIds[0]);
  const other = await sessions.createSessions(admin, input(5, new Date(startAt.getTime() + 3600000)));
  await settings.updateSchedulingSettings(admin, 2);
  assert.equal(memory.rows.get(`timeSlots/${startAt.getTime()}`)?.count, 4);
  await sessions.updateSession(admin, ids[0], input(1));
  await assert.rejects(sessions.createSessions(admin, input(6)), capacityConflict(2));
  await assert.rejects(sessions.updateSession(admin, other.sessionIds[0], input(5)), /2 堂上限/);
  for (const id of ids.slice(0, 3)) await sessions.cancelSession(admin, id, "釋放名額");
  await sessions.updateSession(admin, other.sessionIds[0], input(5));
  assert.equal(memory.rows.get(`timeSlots/${startAt.getTime()}`)?.count, 2);
});

test("同時搶第四個名額只有一筆成功", async () => {
  const [sessions] = await services;
  for (let i = 1; i <= 3; i++) await sessions.createSessions(admin, input(i));
  const result = await Promise.allSettled([sessions.createSessions(admin, input(4)), sessions.createSessions(admin, input(5))]);
  assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(memory.rows.get(`timeSlots/${startAt.getTime()}`)?.count, 4);
});

test("修改設定與預約同時進行時會重試並讀取最新上限", async () => {
  const [sessions, settings] = await services;
  await sessions.createSessions(admin, input(1));
  await settings.updateSchedulingSettings(admin, 2);
  const results = await Promise.allSettled([settings.updateSchedulingSettings(admin, 1), sessions.createSessions(admin, input(2))]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.ok(memory.retries > 0);
  assert.equal(memory.rows.get(`timeSlots/${startAt.getTime()}`)?.count, 1);
});

test("循環課程任一時段滿額時整批失敗", async () => {
  const [sessions, settings] = await services;
  await settings.updateSchedulingSettings(admin, 1);
  await sessions.createSessions(admin, input(1, new Date(startAt.getTime() + 86400000)));
  await assert.rejects(sessions.createSessions(admin, { ...input(2), recurrence: { frequency: "daily", count: 2 } }), capacityConflict(1));
  assert.equal([...memory.rows.keys()].filter((path) => path.startsWith("sessions/")).length, 1);
  assert.equal(memory.rows.has(`timeSlots/${startAt.getTime()}`), false);
});

test("只有 admin 可設定，拒絕無效數字並留下異動紀錄", async () => {
  const [, settings] = await services;
  for (const roles of [["student"], ["coach"]] as SessionPrincipal["roles"][]) {
    await assert.rejects(settings.updateSchedulingSettings({ ...admin, roles }, 5), /只有管理者/);
  }
  for (const value of [0, -1, 1.5, 101, NaN, Infinity]) await assert.rejects(settings.updateSchedulingSettings(admin, value), /整數/);
  assert.equal(memory.rows.has("settings/scheduling"), false);
  await settings.updateSchedulingSettings(admin, 1);
  const log = [...memory.rows.values()].find((row) => row.action === "settings.scheduling_updated")!;
  assert.deepEqual(log.metadata, { previousCapacity: 4, slotCapacity: 1 });
});

test("容量顏色隨設定更新，超額仍顯示額滿", () => {
  assert.equal(slotCapacityState(2, 4), "available");
  assert.equal(slotCapacityState(3, 4), "limited");
  assert.equal(slotCapacityState(4, 4), "full");
  assert.equal(slotCapacityState(4, 2), "full");
  assert.equal(slotCapacityState(0, 1), "limited");
});
