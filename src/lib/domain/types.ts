export const roles = ["admin", "coach", "student"] as const;
export type Role = (typeof roles)[number];

export type CreditSummary = {
  totalRemaining: number;
  reserved: number;
};

export type AppUser = {
  id: string;
  lineUserId: string;
  displayName: string;
  realName: string;
  nickname: string;
  pictureUrl?: string;
  email?: string;
  roles: Role[];
  status: "active" | "disabled";
  credits: CreditSummary;
  createdAt?: Date;
  updatedAt?: Date;
};

export const sessionStatuses = [
  "scheduled",
  "checked_in",
  "completed",
  "not_completed",
  "cancelled",
] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const incompleteReasons = [
  "student_no_show",
  "student_health",
  "coach_issue",
  "facility_issue",
  "other",
] as const;
export type IncompleteReason = (typeof incompleteReasons)[number];

export type ClassSession = {
  id: string;
  studentId: string;
  studentName: string;
  coachId: string;
  coachName: string;
  startAt: Date;
  endAt: Date;
  status: SessionStatus;
  seriesId?: string;
  checkedInAt?: Date;
  checkedInBy?: string;
  completedAt?: Date;
  completedBy?: string;
  incompleteReason?: IncompleteReason;
  incompleteNote?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
};

export type SessionPrincipal = {
  userId: string;
  displayName: string;
  roles: Role[];
};
