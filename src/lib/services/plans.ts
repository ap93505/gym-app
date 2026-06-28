import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { AppError } from "@/lib/domain/errors";

export type PlanInput = { name: string; sessions: number; price: number; active: boolean };

export async function listPlans(activeOnly = false) {
  const snapshot = await db.collection("plans").orderBy("sessions", "asc").get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return { id: doc.id, name: data.name as string, sessions: data.sessions as number, price: data.price as number, active: data.active as boolean };
    })
    .filter((plan) => !activeOnly || plan.active === true);
}

export async function createPlan(actorId: string, input: PlanInput) {
  const ref = db.collection("plans").doc();
  await db.runTransaction(async (tx) => {
    tx.set(ref, { ...input, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("auditLogs").doc(), { action: "plan.created", actorId, targetId: ref.id, metadata: input, createdAt: FieldValue.serverTimestamp() });
  });
  return ref.id;
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
