import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { AppError } from "@/lib/domain/errors";

export type PlanInput = { name: string; sessions: number; price: number; active: boolean };

export async function listPlans(activeOnly = false) {
  const snapshot = await db.collection("plans").get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return { id: doc.id, name: data.name as string, sessions: data.sessions as number, price: data.price as number, active: data.active as boolean, sortOrder: Number(data.sortOrder ?? Number.MAX_SAFE_INTEGER) };
    })
    .filter((plan) => !activeOnly || plan.active === true)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder || a.sessions - b.sessions || a.name.localeCompare(b.name, "zh-TW"));
}

export async function createPlan(actorId: string, input: PlanInput) {
  const ref = db.collection("plans").doc();
  await db.runTransaction(async (tx) => {
    tx.set(ref, { ...input, sortOrder: Date.now(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("auditLogs").doc(), { action: "plan.created", actorId, targetId: ref.id, metadata: input, createdAt: FieldValue.serverTimestamp() });
  });
  return ref.id;
}

export async function reorderPlans(actorId: string, planIds: string[]) {
  const uniqueIds = [...new Set(planIds)];
  if (uniqueIds.length !== planIds.length) throw new AppError("方案排序資料重複", 400, "INVALID_PLAN_ORDER");
  await db.runTransaction(async (tx) => {
    const refs = planIds.map((id) => db.collection("plans").doc(id));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (snapshots.some((snapshot) => !snapshot.exists)) throw new AppError("排序中包含不存在的方案", 404, "PLAN_NOT_FOUND");
    refs.forEach((ref, index) => tx.update(ref, { sortOrder: index, updatedAt: FieldValue.serverTimestamp() }));
    tx.set(db.collection("auditLogs").doc(), { action: "plans.reordered", actorId, metadata: { planIds }, createdAt: FieldValue.serverTimestamp() });
  });
}

export async function updatePlan(actorId: string, planId: string, input: PlanInput) {
  await db.runTransaction(async (tx) => {
    const ref = db.collection("plans").doc(planId);
    const existing = await tx.get(ref);
    if (!existing.exists) throw new AppError("找不到方案", 404, "PLAN_NOT_FOUND");
    tx.update(ref, { ...input, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("auditLogs").doc(), { action: "plan.updated", actorId, targetId: planId, metadata: input, createdAt: FieldValue.serverTimestamp() });
  });
}
