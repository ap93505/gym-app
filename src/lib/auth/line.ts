import { createHash, randomBytes } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/domain/errors";

export function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/member/account";
  return value;
}

export async function exchangeLineCode(code: string, verifier: string) {
  const env = getServerEnv();
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`;
  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.LINE_CHANNEL_ID,
      client_secret: env.LINE_CHANNEL_SECRET,
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("LINE 登入授權失敗", 401, "LINE_TOKEN_EXCHANGE_FAILED");
  return (await response.json()) as { id_token: string; access_token: string };
}

export async function verifyLineIdToken(idToken: string, expectedNonce: string) {
  const env = getServerEnv();
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env.LINE_CHANNEL_ID }),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("LINE 身分驗證失敗", 401, "LINE_ID_TOKEN_INVALID");
  const profile = (await response.json()) as {
    sub: string;
    name?: string;
    picture?: string;
    email?: string;
    nonce?: string;
  };
  if (!profile.sub || profile.nonce !== expectedNonce) {
    throw new AppError("LINE 登入狀態驗證失敗", 401, "LINE_NONCE_MISMATCH");
  }
  return profile;
}
