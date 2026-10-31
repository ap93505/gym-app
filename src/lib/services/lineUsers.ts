import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { DEFAULT_COACH_ID } from "@/lib/domain/cooperatingCoaches";
import type { Role, SessionPrincipal } from "@/lib/domain/types";

export async function upsertLineUser(profile: { sub: string; name?: string; picture?: string; email?: string }): Promise<SessionPrincipal> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection("users").doc(profile.sub);
    const existing = await tx.get(ref);
    const data = existing.data();
    const initialRoles: Role[] = process.env.INITIAL_ADMIN_LINE_USER_ID === profile.sub ? ["admin", "coach", "student"] : ["student"];
    const roles: Role[] = data?.roles ?? initialRoles;
    const displayName = profile.name ?? data?.displayName ?? "LINE 會員";
    const loginFields = {
      lineUserId: profile.sub, displayName,
      ...(profile.picture !== undefined ? { pictureUrl: profile.picture } : {}),
      ...(profile.email !== undefined ? { email: profile.email } : {}),
      ...(data?.cooperatingCoachIds === undefined ? { cooperatingCoachIds: [DEFAULT_COACH_ID] } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (existing.exists) tx.update(ref, loginFields);
    else tx.set(ref, {
      ...loginFields, realName: "", nickname: displayName, roles, status: "active",
      credits: { totalRemaining: 0, reserved: 0 }, createdAt: FieldValue.serverTimestamp(),
    });
    return { userId: profile.sub, displayName, roles };
  });
}
