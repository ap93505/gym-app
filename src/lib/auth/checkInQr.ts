import { createHmac, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { AppError } from "@/lib/domain/errors";

export const QR_REFRESH_SECONDS = 60;
export const QR_VALID_SECONDS = 10 * 60;
const AUDIENCE = "ray:check-in";
const ISSUER = "ray:front-desk";

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET 必須至少 32 個字元");
  return createHmac("sha256", secret).update("ray:check-in-qr:v1").digest();
}

export async function createCheckInQrToken(now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + QR_VALID_SECONDS;
  const token = await new SignJWT({ purpose: "check-in" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key());
  return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export async function verifyCheckInQrToken(token: string, now = new Date()) {
  const secret = key();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE, currentDate: now,
      requiredClaims: ["iat", "exp", "jti"], maxTokenAge: QR_VALID_SECONDS,
    });
    if (payload.purpose !== "check-in") throw new Error("Invalid purpose");
    return { expiresAt: new Date(payload.exp! * 1000).toISOString() };
  } catch {
    throw new AppError("QR Code 已過期或無效，請重新掃描櫃台螢幕上的 QR Code。", 410, "QR_EXPIRED_OR_INVALID");
  }
}
