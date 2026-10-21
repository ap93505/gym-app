import type { CreditPlanSummary } from "./types";

export type BatchBalance = {
  originalUnits: number;
  remainingUnits: number;
  reservedUnits: number;
  hasBeenReserved?: boolean;
  status?: string;
};

export function voidBlockedReason(batch: BatchBalance): string | null {
  if (batch.status === "voided") return "此筆儲值已作廢";
  if (batch.reservedUnits > 0) return "已有預約或報到課程，不能作廢";
  if (batch.remainingUnits !== batch.originalUnits) return "已有使用紀錄，不能整筆作廢";
  if (batch.hasBeenReserved === true) return "曾被預約使用，即使取消也不能作廢";
  if (batch.hasBeenReserved !== false) return "舊儲值缺少完整預約歷程，無法確認從未預約，暫不開放作廢";
  return null;
}

export type SummaryBatch = {
  planId: string;
  planName: string;
  remainingUnits: number;
  reservedUnits: number;
  expiresAt: number;
  shared: boolean;
  status?: string;
};

export function summarizeBatches(batches: SummaryBatch[], now = Date.now()) {
  const plans = new Map<string, CreditPlanSummary>();
  let personalRemaining = 0;
  let sharedRemaining = 0;
  let reserved = 0;
  for (const batch of batches) {
    if (batch.status === "voided" || batch.expiresAt <= now) continue;
    if (batch.shared) sharedRemaining += batch.remainingUnits;
    else personalRemaining += batch.remainingUnits;
    reserved += batch.reservedUnits;
    if (!batch.planId || (batch.remainingUnits <= 0 && batch.reservedUnits <= 0)) continue;
    const plan = plans.get(batch.planId) ?? {
      planId: batch.planId, planName: batch.planName,
      totalRemaining: 0, reserved: 0, available: 0, personalRemaining: 0, sharedRemaining: 0,
    };
    plan.totalRemaining += batch.remainingUnits;
    plan.reserved += batch.reservedUnits;
    plan.available += Math.max(0, batch.remainingUnits - batch.reservedUnits);
    if (batch.shared) plan.sharedRemaining += batch.remainingUnits;
    else plan.personalRemaining += batch.remainingUnits;
    plans.set(batch.planId, plan);
  }
  const totalRemaining = personalRemaining + sharedRemaining;
  return {
    totalRemaining, reserved, available: Math.max(0, totalRemaining - reserved),
    personalRemaining, sharedRemaining,
    plans: [...plans.values()].sort((a, b) => a.planName.localeCompare(b.planName, "zh-TW")),
  };
}
