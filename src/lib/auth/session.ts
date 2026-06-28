import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import type { Role, SessionPrincipal } from "@/lib/domain/types";
import { AppError } from "@/lib/domain/errors";
import { db } from "@/lib/firebase/admin";

const COOKIE_NAME = "ray_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET 必須至少 32 個字元");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(principal: SessionPrincipal) {
  return new SignJWT({ name: principal.displayName, roles: principal.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(principal.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function setSessionCookie(principal: SessionPrincipal) {
  const store = await cookies();
  store.set(COOKIE_NAME, await createSessionToken(principal), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getPrincipal(): Promise<SessionPrincipal | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || !Array.isArray(payload.roles)) return null;
    return {
      userId: payload.sub,
      displayName: typeof payload.name === "string" ? payload.name : "會員",
      roles: payload.roles.filter((role): role is Role => ["admin", "coach", "student"].includes(String(role))),
    };
  } catch {
    return null;
  }
}

export async function requireApiPrincipal(allowedRoles?: Role[]) {
  const tokenPrincipal = await getPrincipal();
  if (!tokenPrincipal) throw new AppError("請先登入", 401, "UNAUTHENTICATED");
  const user = await db.collection("users").doc(tokenPrincipal.userId).get();
  if (!user.exists || user.data()?.status === "disabled") throw new AppError("帳號已停用", 403, "ACCOUNT_DISABLED");
  const principal: SessionPrincipal = {
    userId: tokenPrincipal.userId,
    displayName: user.data()?.realName || user.data()?.nickname || user.data()?.displayName || tokenPrincipal.displayName,
    roles: (user.data()?.roles ?? ["student"]) as Role[],
  };
  if (allowedRoles && !allowedRoles.some((role) => principal.roles.includes(role))) {
    throw new AppError("沒有執行此操作的權限", 403, "FORBIDDEN");
  }
  return principal;
}

export async function requirePagePrincipal(allowedRoles?: Role[]) {
  const tokenPrincipal = await getPrincipal();
  if (!tokenPrincipal) redirect("/login");
  const user = await db.collection("users").doc(tokenPrincipal.userId).get();
  if (!user.exists || user.data()?.status === "disabled") redirect("/login");
  const principal: SessionPrincipal = {
    userId: tokenPrincipal.userId,
    displayName: user.data()?.realName || user.data()?.nickname || user.data()?.displayName || tokenPrincipal.displayName,
    roles: (user.data()?.roles ?? ["student"]) as Role[],
  };
  if (allowedRoles && !allowedRoles.some((role) => principal.roles.includes(role))) redirect("/member/account");
  return principal;
}
