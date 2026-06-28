import assert from "node:assert/strict";
import test from "node:test";
import { availableCredits, consumeReservedCredit, releaseCredit, reserveCredits } from "../src/lib/domain/credits";

test("預約只占用、不扣除總剩餘堂數", () => {
  const reserved = reserveCredits({ totalRemaining: 10, reserved: 2 }, 3);
  assert.deepEqual(reserved, { totalRemaining: 10, reserved: 5 });
  assert.equal(availableCredits(reserved), 5);
});

test("教練確認完成後才扣除一堂", () => {
  assert.deepEqual(consumeReservedCredit({ totalRemaining: 10, reserved: 3 }), {
    totalRemaining: 9,
    reserved: 2,
  });
});

test("未完成或取消會釋放占用堂數", () => {
  assert.deepEqual(releaseCredit({ totalRemaining: 10, reserved: 3 }), {
    totalRemaining: 10,
    reserved: 2,
  });
});

test("不能預約超過可用堂數", () => {
  assert.throws(() => reserveCredits({ totalRemaining: 3, reserved: 2 }, 2), /堂數不足/);
});
