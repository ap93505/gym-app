import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeLineCode, safeReturnTo, verifyLineIdToken } from "@/lib/auth/line";
import { setSessionCookie } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/env";
import { upsertLineUser } from "@/lib/services/lineUsers";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const returnTo = safeReturnTo(store.get("line_oauth_return")?.value ?? null);
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const savedState = store.get("line_oauth_state")?.value;
    const nonce = store.get("line_oauth_nonce")?.value;
    const verifier = store.get("line_oauth_verifier")?.value;
    if (!code || !state || state !== savedState || !nonce || !verifier) {
      throw new Error("LINE OAuth callback state mismatch");
    }
    const tokens = await exchangeLineCode(code, verifier);
    const profile = await verifyLineIdToken(tokens.id_token, nonce);
    await setSessionCookie(await upsertLineUser(profile));
    ["line_oauth_state", "line_oauth_nonce", "line_oauth_verifier", "line_oauth_return"].forEach((name) =>
      store.delete(name),
    );
    return NextResponse.redirect(new URL(returnTo, getAppUrl()));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL(`/login?${new URLSearchParams({ error: "line", returnTo })}`, getAppUrl()));
  }
}
