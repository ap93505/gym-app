import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { assert } from "@/lib/domain/errors";

export async function grantPlanCredits(actorId: string, userId: string, planId: string, sharedMemberIds: string[] = [], copies = 1, requestId: string = randomUUID()) {
  assert(Number.isInteger(copies) && copies >= 1 && copies <= 20, "一次可新增 1 至 20 份方案");
  assert([userId, planId, ...sharedMemberIds].every((id) => !!id && !id.includes("/")), "無效的會員或方案");
  const memberIds = [...new Set([userId, ...sharedMemberIds])].sort();
  assert(memberIds.length <= 20, "每筆儲值最多支援 20 位會員");
  const fingerprint = JSON.stringify({ userId, planId, copies, memberIds });
  const key = createHash("sha256").update(JSON.stringify([actorId, requestId])).digest("hex");
  const requestRef = db.collection("creditGrantRequests").doc(key);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 10);

  return db.runTransaction(async (tx) => {
    const previous = await tx.get(requestRef);
    if (previous.exists) {
      assert(previous.data()!.fingerprint === fingerprint, "這次儲值請求的內容已變更，請重新開啟儲值視窗", 409, "GRANT_REQUEST_CONFLICT");
      return { expiresAt: previous.data()!.expiresAt.toDate() as Date, batchIds: previous.data()!.batchIds as string[] };
    }
    const plan = await tx.get(db.collection("plans").doc(planId));
    assert(plan.exists && plan.data()?.active === true, "找不到可使用的課堂方案", 404, "PLAN_NOT_FOUND");
    const quantity = Number(plan.data()!.sessions);
    assert(Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(quantity * copies), "方案堂數設定錯誤");
    const planName = String(plan.data()!.name ?? planId);
    const members = await tx.getAll(...memberIds.map((id) => db.collection("users").doc(id)));
    assert(members.every((member) => member.exists && member.data()?.roles?.includes("student") && member.data()?.status !== "disabled"), "請選擇有效的學生會員");
    const ownerRef = db.collection("users").doc(userId);
    const batches = Array.from({ length: copies }, () => ownerRef.collection("creditBatches").doc());
    for (const batch of batches) {
      tx.set(batch, {
        originalUnits: quantity, remainingUnits: quantity, reservedUnits: 0,
        memberIds, status: "active", hasBeenReserved: false, planId, planName,
        grantedBy: actorId, grantedAt: Timestamp.fromDate(now), expiresAt: Timestamp.fromDate(expiresAt),
        note: `方案：${planName}`, requestId,
      });
      tx.set(db.collection("creditLedgers").doc(), {
        userId, type: "grant", quantity, batchId: batch.id, planId, planName, actorId,
        note: `方案：${planName}`, createdAt: Timestamp.fromDate(now), requestId,
      });
    }
    for (const member of members) {
      if (member.id !== userId) tx.update(member.ref, { sharedCreditBatchPaths: FieldValue.arrayUnion(...batches.map((batch) => batch.path)) });
    }
    tx.update(ownerRef, { "credits.totalRemaining": FieldValue.increment(quantity * copies), updatedAt: FieldValue.serverTimestamp() });
    const batchIds = batches.map((batch) => batch.id);
    tx.set(requestRef, { actorId, userId, fingerprint, batchIds, expiresAt: Timestamp.fromDate(expiresAt), createdAt: Timestamp.fromDate(now) });
    tx.set(db.collection("auditLogs").doc(), {
      action: "credits.granted", actorId, targetId: userId,
      metadata: { quantity: quantity * copies, copies, planId, expiresAt, memberIds, batchIds, requestId },
      createdAt: FieldValue.serverTimestamp(),
    });
    return { expiresAt, batchIds };
  });
}
