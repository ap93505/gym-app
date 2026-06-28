import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createPkceChallenge, randomUrlSafe, safeReturnTo } from "@/lib/auth/line";
import { getServerEnv } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const env = getServerEnv();
    const state = randomUrlSafe();
    const nonce = randomUrlSafe();
    const verifier = randomUrlSafe(48);
    const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
    const store = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/api/auth/line",
      maxAge: 10 * 60,
    };
    store.set("line_oauth_state", state, cookieOptions);
    store.set("line_oauth_nonce", nonce, cookieOptions);
    store.set("line_oauth_verifier", verifier, cookieOptions);
    store.set("line_oauth_return", returnTo, cookieOptions);

    const authorize = new URL("https://access.line.me/oauth2/v2.1/authorize");
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: env.LINE_CHANNEL_ID,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
      state,
      scope: "openid profile",
      nonce,
      code_challenge: createPkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return NextResponse.redirect(authorize);
  } catch (error) {
    return apiError(error);
  }
}
