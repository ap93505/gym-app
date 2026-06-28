import type { CreditSummary } from "./types";

export function availableCredits(summary: CreditSummary) {
  return Math.max(0, summary.totalRemaining - summary.reserved);
}

export function reserveCredits(summary: CreditSummary, quantity: number): CreditSummary {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("預約堂數必須是正整數");
  if (availableCredits(summary) < quantity) throw new Error("學生可預約堂數不足");
  return { ...summary, reserved: summary.reserved + quantity };
}

export function releaseCredit(summary: CreditSummary): CreditSummary {
  if (summary.reserved < 1) throw new Error("沒有可釋放的預約堂數");
  return { ...summary, reserved: summary.reserved - 1 };
}

export function consumeReservedCredit(summary: CreditSummary): CreditSummary {
  if (summary.reserved < 1 || summary.totalRemaining < 1) throw new Error("堂數狀態不一致");
  return {
    totalRemaining: summary.totalRemaining - 1,
    reserved: summary.reserved - 1,
  };
}
