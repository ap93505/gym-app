import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarBookingInput } from "../src/lib/domain/calendarBooking";

test("月視圖保留所點日期且待選時段，不會預填凌晨或修改日曆日期", () => {
  const date = new Date(2026, 10, 1, 0, 0);
  const before = date.getTime();
  assert.equal(calendarBookingInput(date, true), "2026-11-01T");
  assert.equal(date.getTime(), before);
});

test("週日視圖保留所點日期和時間", () => {
  assert.equal(calendarBookingInput(new Date(2026, 10, 1, 19, 0), false), "2026-11-01T19:00");
});
