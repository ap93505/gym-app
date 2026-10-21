import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { assert } from "@/lib/domain/errors";
import { summarizeBatches, voidBlockedReason } from "@/lib/domain/creditBatches";
import type { SessionPrincipal } from "@/lib/domain/types";

export function batchOwnerId(batch: FirebaseFirestore.DocumentSnapshot) {
  return batch.ref.parent.parent!.id;
}

export function batchMembers(batch: FirebaseFirestore.DocumentSnapshot): string[] {
  return [...new Set([batchOwnerId(batch), ...(batch.data()?.memberIds ?? [])])] as string[];
}

// Sharing indexes locate a batch; membership on the canonical batch grants access.
export async function accessibleBatches(tx: FirebaseFirestore.Transaction, user: FirebaseFirestore.DocumentSnapshot) {
  const owned = await tx.get(user.ref.collection("creditBatches"));
  const paths = [...new Set((user.data()?.sharedCreditBatchPaths ?? []) as string[])]
    .filter((path) => /^users\/[^/]+\/creditBatches\/[^/]+$/.test(path));
  const shared = paths.length ? await tx.getAll(...paths.map((path) => db.doc(path))) : [];
  return [...new Map([...owned.docs, ...shared]
    .filter((batch) => batch.exists && batchMembers(batch).includes(user.id))
    .map((batch) => [batch.ref.path, batch])).values()];
}

export async function userCredits(userRef: FirebaseFirestore.DocumentReference) {
  return db.runTransaction(async (tx) => {
    const user = await tx.get(userRef);
    const batches = await accessibleBatches(tx, user);
    return summarizeBatches(batches.map((batch) => {
      const data = batch.data()!;
      return {
        planId: data.planId ?? "", planName: data.planName ?? data.planId ?? "未指定方案",
        remainingUnits: Number(data.remainingUnits ?? 0), reservedUnits: Number(data.reservedUnits ?? 0),
        expiresAt: data.expiresAt?.toMillis?.() ?? 0, shared: batchMembers(batch).length > 1,
        status: data.status,
      };
    }));
  });
}

export function sessionBatchRef(data: FirebaseFirestore.DocumentData) {
  return db.collection("users").doc(data.creditOwnerId ?? data.studentId)
    .collection("creditBatches").doc(data.creditBatchId);
}

// Retain the legacy owner's aggregate for compatibility; shared balances are read
// from canonical batches rather than copied to every member.
export function updateOwnerBalance(tx: FirebaseFirestore.Transaction, batch: FirebaseFirestore.DocumentSnapshot, remaining: number, reserved: number) {
  tx.update(batch.ref.parent.parent!, {
    "credits.totalRemaining": FieldValue.increment(remaining),
    "credits.reserved": FieldValue.increment(reserved),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function requireAdmin(principal: SessionPrincipal) {
  assert(principal.roles.includes("admin"), "只有管理者可以管理儲值", 403, "FORBIDDEN");
}

export async function listCreditBatches(principal: SessionPrincipal, userId: string) {
  requireAdmin(principal);
  return db.runTransaction(async (tx) => {
    const user = await tx.get(db.collection("users").doc(userId));
    assert(user.exists, "找不到會員", 404, "USER_NOT_FOUND");
    const batches = await accessibleBatches(tx, user);
    const memberIds = [...new Set(batches.flatMap(batchMembers))];
    const members = memberIds.length ? await tx.getAll(...memberIds.map((id) => db.collection("users").doc(id))) : [];
    const names = new Map(members.map((member) => [member.id, member.data()?.realName || member.data()?.nickname || member.data()?.displayName || member.id]));
    return batches.map((batch) => {
      const data = batch.data()!;
      const blockedReason = voidBlockedReason({
        originalUnits: data.originalUnits, remainingUnits: data.remainingUnits,
        reservedUnits: data.reservedUnits, hasBeenReserved: data.hasBeenReserved, status: data.status,
      });
      return {
        id: batch.id, ownerId: batchOwnerId(batch), planName: data.planName ?? "未指定方案",
        originalUnits: data.originalUnits, remainingUnits: data.remainingUnits, reservedUnits: data.reservedUnits,
        grantedAt: data.grantedAt?.toDate().toISOString() ?? null,
        expiresAt: data.expiresAt?.toDate().toISOString() ?? null,
        expired: (data.expiresAt?.toMillis?.() ?? 0) <= Date.now(),
        status: data.status ?? "active", voidReason: data.voidReason ?? "",
        members: batchMembers(batch).map((id) => ({ id, name: names.get(id) ?? id })),
        canVoid: !blockedReason, blockedReason,
      };
    }).sort((a, b) => (b.grantedAt ?? "").localeCompare(a.grantedAt ?? "") || a.id.localeCompare(b.id));
  });
}

export async function addBatchMember(principal: SessionPrincipal, ownerId: string, batchId: string, memberId: string) {
  requireAdmin(principal);
  await db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(ownerId).collection("creditBatches").doc(batchId);
    const batch = await tx.get(ref);
    const memberRef = db.collection("users").doc(memberId);
    const member = await tx.get(memberRef);
    assert(batch.exists, "找不到儲值紀錄", 404, "CREDIT_BATCH_NOT_FOUND");
    assert(batch.data()!.status !== "voided", "已作廢儲值不能共用");
    assert(batch.data()!.expiresAt?.toMillis() > Date.now(), "已到期儲值不能新增共用會員");
    assert(member.exists && member.data()?.roles?.includes("student") && member.data()?.status !== "disabled", "請選擇有效的學生會員");
    const ids = batchMembers(batch);
    if (ids.includes(memberId)) return;
    assert(ids.length < 20, "每筆儲值最多支援 20 位會員");
    tx.update(ref, { memberIds: [...ids, memberId] });
    tx.update(memberRef, { sharedCreditBatchPaths: FieldValue.arrayUnion(ref.path) });
    tx.set(db.collection("auditLogs").doc(), {
      action: "credits.member_added", actorId: principal.userId, targetId: ref.path,
      metadata: { memberId }, createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function voidCreditBatch(principal: SessionPrincipal, ownerId: string, batchId: string, reason: string) {
  requireAdmin(principal);
  assert(reason.trim().length > 0 && reason.trim().length <= 500, "請填寫 1 至 500 字的作廢原因");
  await db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(ownerId).collection("creditBatches").doc(batchId);
    const batch = await tx.get(ref);
    assert(batch.exists, "找不到儲值紀錄", 404, "CREDIT_BATCH_NOT_FOUND");
    const data = batch.data()!;
    const blockedReason = voidBlockedReason({
      originalUnits: data.originalUnits, remainingUnits: data.remainingUnits,
      reservedUnits: data.reservedUnits, hasBeenReserved: data.hasBeenReserved, status: data.status,
    });
    assert(!blockedReason, blockedReason ?? "無法作廢", 409, "CREDIT_BATCH_NOT_VOIDABLE");
    tx.update(ref, { status: "voided", remainingUnits: 0, voidReason: reason.trim(), voidedBy: principal.userId, voidedAt: FieldValue.serverTimestamp() });
    updateOwnerBalance(tx, batch, -data.remainingUnits, 0);
    tx.set(db.collection("creditLedgers").doc(), {
      userId: ownerId, type: "void", quantity: -data.remainingUnits, batchId,
      creditOwnerId: ownerId, planId: data.planId, planName: data.planName,
      actorId: principal.userId, note: reason.trim(), createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("auditLogs").doc(), {
      action: "credits.voided", actorId: principal.userId, targetId: ref.path,
      metadata: { reason: reason.trim(), quantity: data.remainingUnits, memberIds: batchMembers(batch) },
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
