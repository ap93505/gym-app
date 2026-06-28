import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { exchangeLineCode, safeReturnTo, verifyLineIdToken } from "@/lib/auth/line";
import { setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/firebase/admin";
import { getAppUrl } from "@/lib/env";
import type { Role } from "@/lib/domain/types";

export async function GET(request: NextRequest) {
  try {
    const store = await cookies();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const savedState = store.get("line_oauth_state")?.value;
    const nonce = store.get("line_oauth_nonce")?.value;
    const verifier = store.get("line_oauth_verifier")?.value;
    const returnTo = safeReturnTo(store.get("line_oauth_return")?.value ?? null);
    if (!code || !state || state !== savedState || !nonce || !verifier) {
      throw new Error("LINE OAuth callback state mismatch");
    }
    const tokens = await exchangeLineCode(code, verifier);
    const profile = await verifyLineIdToken(tokens.id_token, nonce);
    const userRef = db.collection("users").doc(profile.sub);
    const existing = await userRef.get();
    const initialRoles: Role[] =
      process.env.INITIAL_ADMIN_LINE_USER_ID === profile.sub ? ["admin", "coach", "student"] : ["student"];
    const roles = (existing.data()?.roles as Role[] | undefined) ?? initialRoles;
    const displayName = profile.name ?? existing.data()?.displayName ?? "LINE 會員";

    await userRef.set(
      {
        lineUserId: profile.sub,
        displayName,
        pictureUrl: profile.picture,
        email: profile.email,
        realName: existing.data()?.realName ?? "",
        nickname: existing.data()?.nickname ?? displayName,
        roles,
        status: existing.data()?.status ?? "active",
        credits: existing.data()?.credits ?? { totalRemaining: 0, reserved: 0 },
        createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await setSessionCookie({ userId: profile.sub, displayName, roles });
    ["line_oauth_state", "line_oauth_nonce", "line_oauth_verifier", "line_oauth_return"].forEach((name) =>
      store.delete(name),
    );
    return NextResponse.redirect(new URL(returnTo, getAppUrl()));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/login?error=line", getAppUrl()));
  }
}
