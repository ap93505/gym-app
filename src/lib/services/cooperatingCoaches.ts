import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { assert } from "@/lib/domain/errors";
import { cooperatingCoachIds } from "@/lib/domain/cooperatingCoaches";
import type { SessionPrincipal } from "@/lib/domain/types";

export async function listCoaches() {
  const snapshot = await db.collection("users").where("roles", "array-contains", "coach").get();
  return snapshot.docs.filter((doc) => doc.data().status !== "disabled").map((doc) => {
    const data = doc.data();
    return { id: doc.id, displayName: data.displayName ?? "教練", realName: data.realName ?? "", nickname: data.nickname ?? "" };
  }).sort((a, b) => (a.realName || a.nickname || a.displayName).localeCompare(b.realName || b.nickname || b.displayName, "zh-Hant"));
}

export async function validateCooperatingCoaches(tx: FirebaseFirestore.Transaction, ids: string[]) {
  assert(ids.length >= 1 && ids.length <= 50 && ids.every((id) => typeof id === "string" && !!id && !id.includes("/")), "請選擇 1 至 50 位配合教練");
  const coachIds = [...new Set(ids)];
  const coaches = await tx.getAll(...coachIds.map((id) => db.collection("users").doc(id)));
  assert(coaches.every((coach) => coach.exists && coach.data()?.roles?.includes("coach") && coach.data()?.status !== "disabled"), "配合教練必須是有效且未停用的教練帳號");
  return coachIds;
}

export async function updateCooperatingCoaches(principal: SessionPrincipal, userId: string, ids: string[]) {
  assert(principal.roles.includes("admin") || (principal.roles.includes("student") && principal.userId === userId), "只有學員本人或管理員可以維護配合教練", 403, "FORBIDDEN");
  return db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(userId);
    const user = await tx.get(ref);
    assert(user.exists && user.data()?.roles?.includes("student") && user.data()?.status !== "disabled", "請選擇有效的學員");
    const coachIds = await validateCooperatingCoaches(tx, ids);
    tx.update(ref, { cooperatingCoachIds: coachIds, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("auditLogs").doc(), {
      action: "user.cooperating_coaches_updated", actorId: principal.userId, targetId: userId,
      metadata: { before: cooperatingCoachIds(user.data()!), after: coachIds }, createdAt: FieldValue.serverTimestamp(),
    });
    return coachIds;
  });
}

export function assertCanScheduleStudent(principal: SessionPrincipal, student: FirebaseFirestore.DocumentData, coach: FirebaseFirestore.DocumentData) {
  assert(student.status !== "disabled" && coach.status !== "disabled", "無法替停用的學員或教練排課");
  assert(principal.roles.includes("admin") || cooperatingCoachIds(student).includes(principal.userId), "學員未將你設為配合教練，無法新增或修改排課", 403, "FORBIDDEN");
}
