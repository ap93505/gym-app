import { assert } from "./errors";
import type { SessionStatus } from "./types";

export const CHECK_IN_BEFORE_MS = 30 * 60 * 1000;
export const CHECK_IN_AFTER_MS = 60 * 60 * 1000;

export function isCheckInOpen(start: Date, end: Date, now = new Date()) {
  return now.getTime() >= start.getTime() - CHECK_IN_BEFORE_MS && now.getTime() <= end.getTime() + CHECK_IN_AFTER_MS;
}

export function selfCheckInAction(session: { studentId: string; status: SessionStatus; startAt: Date; endAt: Date }, userId: string, now = new Date()) {
  assert(session.studentId === userId, "此課程不屬於指定學生", 403, "FORBIDDEN");
  if (session.status === "checked_in") return "already_checked_in";
  assert(session.status === "scheduled", "此課程無法報到", 409, "INVALID_SESSION_STATUS");
  assert(isCheckInOpen(session.startAt, session.endAt, now), "目前不在可報到時間內");
  return "check_in";
}
