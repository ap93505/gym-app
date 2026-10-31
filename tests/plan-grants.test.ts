import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { MemoryFirestore } from "./support/memoryFirestore";
import type { SessionPrincipal } from "../src/lib/domain/types";

const memory = new MemoryFirestore();
(globalThis as typeof globalThis & { __rayFirestore?: Firestore }).__rayFirestore = memory as unknown as Firestore;
const services = Promise.all([import("../src/lib/services/users"), import("../src/lib/services/creditBatches")]);
const admin: SessionPrincipal = { userId: "admin", displayName: "管理員", roles: ["admin"] };
beforeEach(() => {
  memory.reset();
  for (const id of ["A", "B"]) memory.seed(`users/${id}`, { roles: ["student"], status: "active", credits: { totalRemaining: 0, reserved: 0 } });
  memory.seed("plans/plan", { active: true, name: "十堂", sessions: 10 });
});

test("一次新增多份方案有獨立紀錄與流水，共用會員可使用每份，單份可作廢", async () => {
  const [users, credits] = await services;
  const result = await users.grantPlanCredits("admin", "A", "plan", ["B"], 3);
  assert.equal(result.batchIds.length, 3);
  assert.equal((await users.getUser("A")).credits.totalRemaining, 30);
  assert.equal((await users.getUser("B")).credits.totalRemaining, 30);
  const batches = await credits.listCreditBatches(admin, "A");
  assert.equal(batches.length, 3);
  assert.ok(batches.every((batch) => batch.originalUnits === 10 && batch.canVoid));
  assert.equal([...memory.rows.keys()].filter((p) => p.startsWith("creditLedgers/")).length, 3);
  await credits.voidCreditBatch(admin, "A", result.batchIds[0], "誤加一份");
  assert.equal((await users.getUser("A")).credits.totalRemaining, 20);
  assert.equal((await users.getUser("B")).credits.totalRemaining, 20);
});

test("同請求並行與重試只入帳一次，方案後來下架仍可取得原成功結果", async () => {
  const [users] = await services;
  const grant = () => users.grantPlanCredits("admin", "A", "plan", ["B"], 2, "request-1");
  const [first, second] = await Promise.all([grant(), grant()]);
  assert.deepEqual(first, second);
  assert.ok(memory.retries > 0);
  memory.seed("plans/plan", { active: false, name: "下架", sessions: 99 });
  assert.deepEqual(await grant(), first);
  assert.equal((await users.getUser("A")).credits.totalRemaining, 20);
  assert.equal([...memory.rows.keys()].filter((p) => p.startsWith("creditGrantRequests/")).length, 1);
  await assert.rejects(users.grantPlanCredits("admin", "A", "plan", ["B"], 3, "request-1"), /內容已變更/);
});

test("不同操作各自加值，同時加值不會覆寫餘額", async () => {
  const [users] = await services;
  await Promise.all([users.grantPlanCredits("admin", "A", "plan", [], 2, "one"), users.grantPlanCredits("admin", "A", "plan", [], 3, "two")]);
  assert.equal((await users.getUser("A")).credits.totalRemaining, 50);
  assert.deepEqual(memory.rows.get("users/A")?.credits, { totalRemaining: 50, reserved: 0 });
});

test("無效份數、方案或共用會員整批拒絕，沒有部分入帳", async () => {
  const [users] = await services;
  for (const count of [0, -1, 1.5, 21, NaN]) await assert.rejects(users.grantPlanCredits("admin", "A", "plan", [], count));
  await assert.rejects(users.grantPlanCredits("admin", "A", "missing", [], 3));
  await assert.rejects(users.grantPlanCredits("admin", "A", "plan", ["missing"], 3));
  memory.seed("users/B", { roles: ["student"], status: "disabled" });
  await assert.rejects(users.grantPlanCredits("admin", "A", "plan", ["B"], 3));
  assert.equal(memory.rows.size, 3);
  assert.deepEqual(memory.rows.get("users/A")?.credits, { totalRemaining: 0, reserved: 0 });
});

test("單筆上限 20 份都成功且每份保留獨立堂數", async () => {
  const [users, credits] = await services;
  await users.grantPlanCredits("admin", "A", "plan", [], 20);
  assert.equal((await credits.listCreditBatches(admin, "A")).length, 20);
  assert.equal((await users.getUser("A")).credits.totalRemaining, 200);
});
