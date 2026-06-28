import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { AppError, assert } from "@/lib/domain/errors";
import { availableCredits, consumeReservedCredit, releaseCredit, reserveCredits } from "@/lib/domain/credits";
import { generateOccurrences, type RecurrenceRule } from "@/lib/domain/recurrence";
import type { IncompleteReason, Role, SessionPrincipal, SessionStatus } from "@/lib/domain/types";
import { creditSummary } from "./users";

const HOUR_MS = 60 * 60 * 1000;
const CHECK_IN_BEFORE_MS = 30 * 60 * 1000;
const MAX_GROUPS_PER_SLOT = 3;

function assertBookableStart(start: Date) {
  const taipeiHour = (start.getUTCHours() + 8) % 24;
  assert(start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0, "課程必須從整點開始");
  assert(taipeiHour >= 10 && taipeiHour < 22, "可預約時段為上午 10 點至晚上 10 點");
}

function slotId(start: Date) {
  return String(start.getTime());
}

function lockId(userId: string, start: Date) {
  return `${userId}_${start.getTime()}`;
}

function userName(data: FirebaseFirestore.DocumentData) {
  return data.realName || data.nickname || data.displayName || "會員";
}

function ensureCanManageCoach(principal: SessionPrincipal, coachId: string) {
  if (!principal.roles.includes("admin") && (!principal.roles.includes("coach") || principal.userId !== coachId)) {
    throw new AppError("教練只能管理自己的課程", 403, "FORBIDDEN");
  }
}

export type CreateSessionsInput = {
  studentId: string;
  coachId: string;
  startAt: Date;
  recurrence: RecurrenceRule;
};

export async function createSessions(principal: SessionPrincipal, input: CreateSessionsInput) {
  assertBookableStart(input.startAt);
  ensureCanManageCoach(principal, input.coachId);
  assert(input.startAt.getTime() > Date.now(), "只能建立未來的課程");
  const occurrences = generateOccurrences(input.startAt, input.recurrence);
  const seriesRef = occurrences.length > 1 ? db.collection("recurrenceSeries").doc() : null;
  const sessionRefs = occurrences.map(() => db.collection("sessions").doc());

  await db.runTransaction(async (tx) => {
    const studentRef = db.collection("users").doc(input.studentId);
    const coachRef = db.collection("users").doc(input.coachId);
    const studentSnapshot = await tx.get(studentRef);
    const coachSnapshot = await tx.get(coachRef);
    if (!studentSnapshot.exists) throw new AppError("找不到學生", 404, "STUDENT_NOT_FOUND");
    if (!coachSnapshot.exists) throw new AppError("找不到教練", 404, "COACH_NOT_FOUND");
    assert((studentSnapshot.data()!.roles as Role[]).includes("student"), "指定帳號不是學生");
    assert((coachSnapshot.data()!.roles as Role[]).includes("coach"), "指定帳號不是教練");
    const summary = creditSummary(studentSnapshot.data());
    if (availableCredits(summary) < occurrences.length) {
      throw new AppError("學生可預約堂數不足", 409, "INSUFFICIENT_CREDITS", {
        available: availableCredits(summary),
        requested: occurrences.length,
      });
    }

    const refGroups = occurrences.map((start) => ({
      slot: db.collection("timeSlots").doc(slotId(start)),
      coach: db.collection("coachSlotLocks").doc(lockId(input.coachId, start)),
      student: db.collection("studentSlotLocks").doc(lockId(input.studentId, start)),
    }));
    const snapshots = [] as Array<{
      slot: FirebaseFirestore.DocumentSnapshot;
      coach: FirebaseFirestore.DocumentSnapshot;
      student: FirebaseFirestore.DocumentSnapshot;
    }>;
    for (const refs of refGroups) {
      snapshots.push({
        slot: await tx.get(refs.slot),
        coach: await tx.get(refs.coach),
        student: await tx.get(refs.student),
      });
    }
    const conflicts: string[] = [];
    snapshots.forEach((group, index) => {
      const start = occurrences[index];
      if (Number(group.slot.data()?.count ?? 0) >= MAX_GROUPS_PER_SLOT) conflicts.push(`${start.toISOString()} 時段已滿`);
      if (group.coach.exists) conflicts.push(`${start.toISOString()} 教練已有課程`);
      if (group.student.exists) conflicts.push(`${start.toISOString()} 學生已有課程`);
    });
    if (conflicts.length) throw new AppError("部分課程時段衝突", 409, "SCHEDULE_CONFLICT", conflicts);

    const studentName = userName(studentSnapshot.data()!);
    const coachName = userName(coachSnapshot.data()!);
    const now = Timestamp.now();
    occurrences.forEach((start, index) => {
      const end = new Date(start.getTime() + HOUR_MS);
      const sessionRef = sessionRefs[index];
      const refs = refGroups[index];
      const existingSessionIds = (snapshots[index].slot.data()?.sessionIds as string[] | undefined) ?? [];
      tx.set(sessionRef, {
        studentId: input.studentId,
        studentName,
        coachId: input.coachId,
        coachName,
        startAt: Timestamp.fromDate(start),
        endAt: Timestamp.fromDate(end),
        status: "scheduled" satisfies SessionStatus,
        seriesId: seriesRef?.id ?? null,
        createdBy: principal.userId,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(refs.slot, {
        startAt: Timestamp.fromDate(start),
        count: existingSessionIds.length + 1,
        sessionIds: [...existingSessionIds, sessionRef.id],
      });
      tx.set(refs.coach, { sessionId: sessionRef.id, coachId: input.coachId, startAt: Timestamp.fromDate(start) });
      tx.set(refs.student, { sessionId: sessionRef.id, studentId: input.studentId, startAt: Timestamp.fromDate(start) });
    });
    tx.update(studentRef, {
      credits: reserveCredits(summary, occurrences.length),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (seriesRef) {
      tx.set(seriesRef, {
        studentId: input.studentId,
        coachId: input.coachId,
        frequency: input.recurrence.frequency,
        count: occurrences.length,
        startAt: Timestamp.fromDate(occurrences[0]),
        endAt: Timestamp.fromDate(occurrences.at(-1)!),
        createdBy: principal.userId,
        createdAt: now,
      });
    }
    tx.set(db.collection("auditLogs").doc(), {
      action: "sessions.created",
      actorId: principal.userId,
      targetId: seriesRef?.id ?? sessionRefs[0].id,
      metadata: { count: occurrences.length, studentId: input.studentId, coachId: input.coachId },
      createdAt: now,
    });
  });
  return { sessionIds: sessionRefs.map((ref) => ref.id), count: occurrences.length };
}

export async function updateSession(
  principal: SessionPrincipal,
  sessionId: string,
  input: { studentId: string; coachId: string; startAt: Date },
) {
  assertBookableStart(input.startAt);
  assert(input.startAt.getTime() > Date.now(), "只能將課程調整到未來時段");
  await db.runTransaction(async (tx) => {
    const sessionRef = db.collection("sessions").doc(sessionId);
    const session = await tx.get(sessionRef);
    if (!session.exists) throw new AppError("找不到課程", 404, "SESSION_NOT_FOUND");
    const data = session.data()!;
    ensureCanManageCoach(principal, data.coachId);
    ensureCanManageCoach(principal, input.coachId);
    assert((data.startAt.toDate() as Date).getTime() > Date.now(), "只能修改尚未發生的課程");
    assert(data.status === "scheduled", "只有尚未報到的課程可以修改");

    const oldStart = data.startAt.toDate() as Date;
    const timeChanged = oldStart.getTime() !== input.startAt.getTime();
    const studentChanged = data.studentId !== input.studentId;
    const coachChanged = data.coachId !== input.coachId;
    const oldStudentRef = db.collection("users").doc(data.studentId);
    const newStudentRef = db.collection("users").doc(input.studentId);
    const newCoachRef = db.collection("users").doc(input.coachId);
    const oldSlotRef = db.collection("timeSlots").doc(slotId(oldStart));
    const newSlotRef = db.collection("timeSlots").doc(slotId(input.startAt));

    const oldStudent = await tx.get(oldStudentRef);
    const newStudent = studentChanged ? await tx.get(newStudentRef) : oldStudent;
    const newCoach = await tx.get(newCoachRef);
    const oldSlot = await tx.get(oldSlotRef);
    const newSlot = timeChanged ? await tx.get(newSlotRef) : oldSlot;
    const newCoachLockRef = db.collection("coachSlotLocks").doc(lockId(input.coachId, input.startAt));
    const newStudentLockRef = db.collection("studentSlotLocks").doc(lockId(input.studentId, input.startAt));
    const newCoachLock = timeChanged || coachChanged ? await tx.get(newCoachLockRef) : null;
    const newStudentLock = timeChanged || studentChanged ? await tx.get(newStudentLockRef) : null;

    if (!oldStudent.exists || !newStudent.exists) throw new AppError("找不到學生", 404, "STUDENT_NOT_FOUND");
    if (!newCoach.exists) throw new AppError("找不到教練", 404, "COACH_NOT_FOUND");
    assert((newStudent.data()!.roles as Role[]).includes("student"), "指定帳號不是學生");
    assert((newCoach.data()!.roles as Role[]).includes("coach"), "指定帳號不是教練");
    if (timeChanged && Number(newSlot.data()?.count ?? 0) >= MAX_GROUPS_PER_SLOT) {
      throw new AppError("新時段已達三組上限", 409, "SLOT_FULL");
    }
    if (newCoachLock?.exists) throw new AppError("教練在新時段已有課程", 409, "COACH_CONFLICT");
    if (newStudentLock?.exists) throw new AppError("學生在新時段已有課程", 409, "STUDENT_CONFLICT");
    if (studentChanged && availableCredits(creditSummary(newStudent.data())) < 1) {
      throw new AppError("新學生沒有可預約堂數", 409, "INSUFFICIENT_CREDITS");
    }

    const now = Timestamp.now();
    if (timeChanged) {
      const oldIds = ((oldSlot.data()?.sessionIds as string[] | undefined) ?? []).filter((id) => id !== sessionId);
      const newIds = (newSlot.data()?.sessionIds as string[] | undefined) ?? [];
      tx.set(oldSlotRef, { startAt: data.startAt, count: oldIds.length, sessionIds: oldIds });
      tx.set(newSlotRef, {
        startAt: Timestamp.fromDate(input.startAt),
        count: newIds.length + 1,
        sessionIds: [...newIds, sessionId],
      });
    }
    if (timeChanged || coachChanged) {
      tx.delete(db.collection("coachSlotLocks").doc(lockId(data.coachId, oldStart)));
      tx.set(newCoachLockRef, { sessionId, coachId: input.coachId, startAt: Timestamp.fromDate(input.startAt) });
    }
    if (timeChanged || studentChanged) {
      tx.delete(db.collection("studentSlotLocks").doc(lockId(data.studentId, oldStart)));
      tx.set(newStudentLockRef, { sessionId, studentId: input.studentId, startAt: Timestamp.fromDate(input.startAt) });
    }
    if (studentChanged) {
      tx.update(oldStudentRef, { credits: releaseCredit(creditSummary(oldStudent.data())), updatedAt: now });
      tx.update(newStudentRef, { credits: reserveCredits(creditSummary(newStudent.data()), 1), updatedAt: now });
    }
    tx.update(sessionRef, {
      studentId: input.studentId,
      studentName: userName(newStudent.data()!),
      coachId: input.coachId,
      coachName: userName(newCoach.data()!),
      startAt: Timestamp.fromDate(input.startAt),
      endAt: Timestamp.fromDate(new Date(input.startAt.getTime() + HOUR_MS)),
      updatedAt: now,
      updatedBy: principal.userId,
    });
    tx.set(db.collection("auditLogs").doc(), {
      action: "session.updated",
      actorId: principal.userId,
      targetId: sessionId,
      metadata: { studentId: input.studentId, coachId: input.coachId, startAt: input.startAt },
      createdAt: now,
    });
  });
}

function sessionJson(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data()!;
  return {
    id: doc.id,
    studentId: data.studentId,
    studentName: data.studentName,
    coachId: data.coachId,
    coachName: data.coachName,
    startAt: data.startAt.toDate().toISOString(),
    endAt: data.endAt.toDate().toISOString(),
    status: data.status as SessionStatus,
    seriesId: data.seriesId ?? undefined,
    checkedInAt: data.checkedInAt?.toDate().toISOString(),
    incompleteReason: data.incompleteReason,
    incompleteNote: data.incompleteNote,
  };
}

export async function listSessions(from: Date, to: Date, principal: SessionPrincipal, mineOnly = false) {
  const snapshot = await db
    .collection("sessions")
    .where("startAt", ">=", Timestamp.fromDate(from))
    .where("startAt", "<", Timestamp.fromDate(to))
    .orderBy("startAt", "asc")
    .get();
  const sessions = snapshot.docs.map(sessionJson);
  return mineOnly || (principal.roles.length === 1 && principal.roles.includes("student"))
    ? sessions.filter((session) => session.studentId === principal.userId)
    : sessions;
}

export async function eligibleCheckins(userId: string) {
  const now = new Date();
  const snapshot = await db
    .collection("sessions")
    .where("studentId", "==", userId)
    .get();
  return snapshot.docs
    .map(sessionJson)
    .filter((session) => session.status === "scheduled" && new Date(session.endAt) >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 10)
    .map((session) => {
      const start = new Date(session.startAt);
      const end = new Date(session.endAt);
      const opensAt = new Date(start.getTime() - CHECK_IN_BEFORE_MS);
      return {
        ...session,
        canCheckIn: now >= opensAt && now <= end,
        checkInOpensAt: opensAt.toISOString(),
      };
    });
}

export async function checkIn(principal: SessionPrincipal, sessionId: string, studentId?: string) {
  const targetStudentId = studentId ?? principal.userId;
  if (studentId && !principal.roles.includes("admin")) throw new AppError("只有管理者可補登報到", 403, "FORBIDDEN");
  await db.runTransaction(async (tx) => {
    const ref = db.collection("sessions").doc(sessionId);
    const session = await tx.get(ref);
    if (!session.exists) throw new AppError("找不到課程", 404, "SESSION_NOT_FOUND");
    const data = session.data()!;
    assert(data.studentId === targetStudentId, "此課程不屬於指定學生", 403, "FORBIDDEN");
    assert(data.status === "scheduled", "此課程無法重複報到", 409, "INVALID_SESSION_STATUS");
    const now = new Date();
    const start = data.startAt.toDate() as Date;
    const end = data.endAt.toDate() as Date;
    if (!studentId) {
      assert(now.getTime() >= start.getTime() - CHECK_IN_BEFORE_MS && now <= end, "目前不在可報到時間內");
    }
    tx.update(ref, {
      status: "checked_in",
      checkedInAt: Timestamp.fromDate(now),
      checkedInBy: principal.userId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("auditLogs").doc(), {
      action: studentId ? "session.checkin_backfilled" : "session.checked_in",
      actorId: principal.userId,
      targetId: sessionId,
      createdAt: Timestamp.fromDate(now),
    });
  });
}

export async function confirmOutcome(
  principal: SessionPrincipal,
  sessionId: string,
  outcome: "completed" | "not_completed",
  reason?: IncompleteReason,
  note?: string,
) {
  await db.runTransaction(async (tx) => {
    const sessionRef = db.collection("sessions").doc(sessionId);
    const session = await tx.get(sessionRef);
    if (!session.exists) throw new AppError("找不到課程", 404, "SESSION_NOT_FOUND");
    const data = session.data()!;
    ensureCanManageCoach(principal, data.coachId);
    assert((data.endAt.toDate() as Date).getTime() <= Date.now(), "課程結束後才能確認結果");
    assert(["scheduled", "checked_in"].includes(data.status), "此課程結果已確認", 409, "INVALID_SESSION_STATUS");
    if (outcome === "completed") assert(data.status === "checked_in", "學生尚未報到，請由管理者補登後再完成");
    if (outcome === "not_completed") {
      assert(reason, "未完成課程必須選擇原因");
      assert(note?.trim(), "未完成課程必須填寫說明");
    }

    const studentRef = db.collection("users").doc(data.studentId);
    const student = await tx.get(studentRef);
    if (!student.exists) throw new AppError("找不到學生", 404, "STUDENT_NOT_FOUND");
    const summary = creditSummary(student.data());
    let batch: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    if (outcome === "completed") {
      const batches = await tx.get(studentRef.collection("creditBatches").orderBy("expiresAt", "asc"));
      batch = batches.docs.find(
        (doc) => Number(doc.data().remainingUnits ?? 0) > 0 && (doc.data().expiresAt.toDate() as Date) > new Date(),
      );
      if (!batch) throw new AppError("找不到可扣除的有效堂數批次", 409, "CREDIT_BATCH_NOT_FOUND");
    }

    const nextSummary = outcome === "completed" ? consumeReservedCredit(summary) : releaseCredit(summary);
    const now = Timestamp.now();
    tx.update(studentRef, { credits: nextSummary, updatedAt: now });
    tx.update(sessionRef, {
      status: outcome,
      completedAt: now,
      completedBy: principal.userId,
      incompleteReason: outcome === "not_completed" ? reason : FieldValue.delete(),
      incompleteNote: outcome === "not_completed" ? note?.trim() : FieldValue.delete(),
      updatedAt: now,
    });
    if (batch) {
      tx.update(batch.ref, { remainingUnits: Number(batch.data().remainingUnits) - 1 });
      tx.set(db.collection("creditLedgers").doc(), {
        userId: data.studentId,
        type: "consume",
        quantity: -1,
        batchId: batch.id,
        sessionId,
        actorId: principal.userId,
        createdAt: now,
      });
    }
    tx.set(db.collection("auditLogs").doc(), {
      action: `session.${outcome}`,
      actorId: principal.userId,
      targetId: sessionId,
      metadata: outcome === "not_completed" ? { reason, note: note?.trim() } : {},
      createdAt: now,
    });
  });
}

function releaseSlotWrites(
  tx: FirebaseFirestore.Transaction,
  sessionId: string,
  data: FirebaseFirestore.DocumentData,
  slot: FirebaseFirestore.DocumentSnapshot,
) {
  const start = data.startAt.toDate() as Date;
  const ids = ((slot.data()?.sessionIds as string[] | undefined) ?? []).filter((id) => id !== sessionId);
  tx.set(slot.ref, { startAt: data.startAt, count: ids.length, sessionIds: ids });
  tx.delete(db.collection("coachSlotLocks").doc(lockId(data.coachId, start)));
  tx.delete(db.collection("studentSlotLocks").doc(lockId(data.studentId, start)));
}

export async function cancelSession(principal: SessionPrincipal, sessionId: string, reason: string) {
  assert(principal.roles.includes("admin"), "只有管理者可以取消課程", 403, "FORBIDDEN");
  assert(reason.trim(), "取消課程必須填寫原因");
  await db.runTransaction(async (tx) => {
    const sessionRef = db.collection("sessions").doc(sessionId);
    const session = await tx.get(sessionRef);
    if (!session.exists) throw new AppError("找不到課程", 404, "SESSION_NOT_FOUND");
    const data = session.data()!;
    assert((data.startAt.toDate() as Date).getTime() > Date.now(), "只能取消尚未發生的課程");
    assert(["scheduled", "checked_in"].includes(data.status), "此課程無法取消");
    const studentRef = db.collection("users").doc(data.studentId);
    const slotRef = db.collection("timeSlots").doc(slotId(data.startAt.toDate()));
    const student = await tx.get(studentRef);
    const slot = await tx.get(slotRef);
    if (!student.exists) throw new AppError("找不到學生", 404, "STUDENT_NOT_FOUND");
    const now = Timestamp.now();
    tx.update(studentRef, { credits: releaseCredit(creditSummary(student.data())), updatedAt: now });
    tx.update(sessionRef, {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: principal.userId,
      cancellationReason: reason.trim(),
      updatedAt: now,
    });
    releaseSlotWrites(tx, sessionId, data, slot);
    tx.set(db.collection("auditLogs").doc(), {
      action: "session.cancelled",
      actorId: principal.userId,
      targetId: sessionId,
      metadata: { reason: reason.trim() },
      createdAt: now,
    });
  });
}

export async function pendingConfirmations(principal: SessionPrincipal) {
  assert(principal.roles.includes("coach") || principal.roles.includes("admin"), "沒有權限", 403, "FORBIDDEN");
  const snapshot = await db
    .collection("sessions")
    .where("endAt", "<=", Timestamp.now())
    .orderBy("endAt", "desc")
    .limit(500)
    .get();
  return snapshot.docs
    .map(sessionJson)
    .filter((session) => ["scheduled", "checked_in"].includes(session.status))
    .filter((session) => principal.roles.includes("admin") || session.coachId === principal.userId)
    .slice(0, 100);
}
