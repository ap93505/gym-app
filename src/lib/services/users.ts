import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { AppError, assert } from "@/lib/domain/errors";
import { availableCredits } from "@/lib/domain/credits";
import type { CreditSummary, Role } from "@/lib/domain/types";

export function creditSummary(data: FirebaseFirestore.DocumentData | undefined): CreditSummary {
  return {
    totalRemaining: Number(data?.credits?.totalRemaining ?? 0),
    reserved: Number(data?.credits?.reserved ?? 0),
  };
}

export async function getUser(userId: string) {
  const snapshot = await db.collection("users").doc(userId).get();
  if (!snapshot.exists) throw new AppError("找不到會員", 404, "USER_NOT_FOUND");
  const data = snapshot.data()!;
  const credits = creditSummary(data);
  return {
    id: snapshot.id,
    lineUserId: data.lineUserId,
    displayName: data.displayName ?? "會員",
    realName: data.realName ?? "",
    nickname: data.nickname ?? "",
    pictureUrl: data.pictureUrl,
    email: data.email,
    roles: (data.roles ?? ["student"]) as Role[],
    status: data.status ?? "active",
    credits: { ...credits, available: availableCredits(credits) },
  };
}

export async function listUsers(role?: Role) {
  let query: FirebaseFirestore.Query = db.collection("users");
  if (role) query = query.where("roles", "array-contains", role);
  else query = query.orderBy("displayName");
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const credits = creditSummary(data);
    return {
      id: doc.id,
      displayName: data.displayName ?? "會員",
      realName: data.realName ?? "",
      nickname: data.nickname ?? "",
      roles: data.roles ?? ["student"],
      status: data.status ?? "active",
      credits: { ...credits, available: availableCredits(credits) },
    };
  }).sort((a, b) => (a.realName || a.nickname || a.displayName).localeCompare(b.realName || b.nickname || b.displayName, "zh-Hant"));
}

export async function updateOwnProfile(userId: string, realName: string, nickname: string) {
  await db.collection("users").doc(userId).update({
    realName: realName.trim(),
    nickname: nickname.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateUserRoles(actorId: string, userId: string, roles: Role[]) {
  assert(roles.length > 0, "帳號至少需要一個角色");
  assert(actorId !== userId || roles.includes("admin"), "管理者不能移除自己的管理權限");
  await db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(userId);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new AppError("找不到會員", 404, "USER_NOT_FOUND");
    tx.update(ref, { roles, updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection("auditLogs").doc(), {
      action: "user.roles_updated",
      actorId,
      targetId: userId,
      metadata: { roles },
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

function tenYearsFrom(date: Date) {
  const expiry = new Date(date);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 10);
  return expiry;
}

export async function grantCredits(actorId: string, userId: string, quantity: number, planId?: string, note?: string) {
  assert(Number.isInteger(quantity) && quantity > 0, "加值堂數必須是正整數");
  const now = new Date();
  const expiresAt = tenYearsFrom(now);
  await db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(userId);
    const user = await tx.get(userRef);
    if (!user.exists) throw new AppError("找不到會員", 404, "USER_NOT_FOUND");
    const summary = creditSummary(user.data());
    const batchRef = userRef.collection("creditBatches").doc();
    const ledgerRef = db.collection("creditLedgers").doc();
    tx.set(batchRef, {
      originalUnits: quantity,
      remainingUnits: quantity,
      planId: planId ?? null,
      grantedBy: actorId,
      grantedAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt),
      note: note ?? "",
    });
    tx.set(ledgerRef, {
      userId,
      type: "grant",
      quantity,
      batchId: batchRef.id,
      planId: planId ?? null,
      actorId,
      note: note ?? "",
      createdAt: Timestamp.fromDate(now),
    });
    tx.update(userRef, {
      "credits.totalRemaining": summary.totalRemaining + quantity,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection("auditLogs").doc(), {
      action: "credits.granted",
      actorId,
      targetId: userId,
      metadata: { quantity, planId: planId ?? null, expiresAt },
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { expiresAt };
}

export async function grantPlanCredits(actorId: string, userId: string, planId: string) {
  const plan = await db.collection("plans").doc(planId).get();
  if (!plan.exists || plan.data()?.active !== true) throw new AppError("找不到可使用的課堂方案", 404, "PLAN_NOT_FOUND");
  const quantity = Number(plan.data()?.sessions ?? 0);
  assert(Number.isInteger(quantity) && quantity > 0, "方案堂數設定錯誤");
  return grantCredits(actorId, userId, quantity, planId, `方案：${plan.data()?.name ?? planId}`);
}
