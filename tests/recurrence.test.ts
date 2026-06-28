import assert from "node:assert/strict";
import test from "node:test";
import { calculateEndAt, generateOccurrences } from "../src/lib/domain/recurrence";

test("每日循環依照次數建立", () => {
  const start = new Date("2026-06-28T02:00:00.000Z");
  const values = generateOccurrences(start, { frequency: "daily", count: 3 });
  assert.deepEqual(values.map((value) => value.toISOString()), [
    "2026-06-28T02:00:00.000Z",
    "2026-06-29T02:00:00.000Z",
    "2026-06-30T02:00:00.000Z",
  ]);
});

test("每月 31 日在短月份使用該月最後一天", () => {
  const start = new Date("2026-01-31T02:00:00.000Z");
  const values = generateOccurrences(start, { frequency: "monthly", count: 3 });
  assert.deepEqual(values.map((value) => value.toISOString()), [
    "2026-01-31T02:00:00.000Z",
    "2026-02-28T02:00:00.000Z",
    "2026-03-31T02:00:00.000Z",
  ]);
});

test("結束日採包含式計算", () => {
  const start = new Date("2026-06-01T02:00:00.000Z");
  const values = generateOccurrences(start, { frequency: "weekly", endAt: new Date("2026-06-15T02:00:00.000Z") });
  assert.equal(values.length, 3);
  assert.equal(calculateEndAt(start, "weekly", 3).toISOString(), "2026-06-15T02:00:00.000Z");
});

test("單次建立上限為一百堂", () => {
  assert.throws(
    () => generateOccurrences(new Date("2026-01-01T00:00:00.000Z"), { frequency: "daily", count: 101 }),
    /最多建立 100 堂/,
  );
});
