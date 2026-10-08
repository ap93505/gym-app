import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { createCheckInQrToken, verifyCheckInQrToken } from "../src/lib/auth/checkInQr";
import { safeReturnTo } from "../src/lib/auth/returnTo";
import { isCheckInOpen, selfCheckInAction } from "../src/lib/domain/checkIn";
import type { SessionStatus } from "../src/lib/domain/types";

process.env.SESSION_SECRET = "qr-test-secret-that-is-at-least-32-characters";
const now = new Date("2026-10-08T04:00:00Z");

test("QR 可供多位會員使用，10 分鐘後失效且不因重掃延長", async () => {
  const { token, expiresAt } = await createCheckInQrToken(now);
  assert.equal(expiresAt, "2026-10-08T04:10:00.000Z");
  await verifyCheckInQrToken(token, now);
  await verifyCheckInQrToken(token, new Date(now.getTime() + 599_999));
  await assert.rejects(verifyCheckInQrToken(token, new Date(now.getTime() + 600_000)), { code: "QR_EXPIRED_OR_INVALID" });
});

test("拒絕竄改、空白、未生效的 QR 以及拿登入 Session 充當 QR", async () => {
  const { token } = await createCheckInQrToken(now);
  const parts = token.split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  parts[1] = Buffer.from(JSON.stringify({ ...payload, exp: payload.exp + 3600 })).toString("base64url");
  await assert.rejects(verifyCheckInQrToken(parts.join("."), now));
  await assert.rejects(verifyCheckInQrToken("", now));
  await assert.rejects(verifyCheckInQrToken(token, new Date(now.getTime() - 1000)));
  const session = await new SignJWT({ roles: ["admin"] }).setSubject("admin").setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  await assert.rejects(verifyCheckInQrToken(session, now));
});

test("QR 必須有正確用途、發行者、對象及效期", async () => {
  const key = createHmac("sha256", process.env.SESSION_SECRET!).update("ray:check-in-qr:v1").digest();
  const base = { purpose: "check-in", iss: "ray:front-desk", aud: "ray:check-in", iat: now.getTime() / 1000, exp: now.getTime() / 1000 + 600, jti: "test" };
  for (const override of [{ purpose: "login" }, { iss: "other" }, { aud: "other" }, { exp: undefined }, { jti: undefined }]) {
    const token = await new SignJWT({ ...base, ...override }).setProtectedHeader({ alg: "HS256" }).sign(key);
    await assert.rejects(verifyCheckInQrToken(token, now));
  }
});

test("登入返回網址保留 QR 參數並拒絕外站與反斜線繞過", () => {
  assert.equal(safeReturnTo("/check-in?token=abc.def&x=1"), "/check-in?token=abc.def&x=1");
  for (const value of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/\n/evil.example", "/a/..//evil.example", "/a/%2e%2e//evil.example", "javascript:alert(1)"]) {
    assert.equal(safeReturnTo(value), "/member/account");
  }
});

const session = { studentId: "student-a", status: "scheduled" as SessionStatus, startAt: now, endAt: new Date(now.getTime() + 3600_000) };

test("報到精確包含上課前 30 分鐘和下課後 60 分鐘邊界", () => {
  assert.equal(isCheckInOpen(session.startAt, session.endAt, new Date(now.getTime() - 1800_000)), true);
  assert.equal(isCheckInOpen(session.startAt, session.endAt, new Date(now.getTime() - 1800_001)), false);
  assert.equal(isCheckInOpen(session.startAt, session.endAt, new Date(now.getTime() + 7200_000)), true);
  assert.equal(isCheckInOpen(session.startAt, session.endAt, new Date(now.getTime() + 7200_001)), false);
});

test("只允許本人報到，重送已報到課程不再寫入", () => {
  assert.equal(selfCheckInAction(session, "student-a", now), "check_in");
  assert.equal(selfCheckInAction({ ...session, status: "checked_in" }, "student-a", now), "already_checked_in");
  for (const status of ["scheduled", "checked_in"] as const) {
    assert.throws(() => selfCheckInAction({ ...session, status }, "student-b", now), { code: "FORBIDDEN" });
  }
});

test("取消、已結算與非報到時間的預約不可報到", () => {
  for (const status of ["completed", "not_completed", "cancelled"] as const) {
    assert.throws(() => selfCheckInAction({ ...session, status }, "student-a", now), { code: "INVALID_SESSION_STATUS" });
  }
  assert.throws(() => selfCheckInAction(session, "student-a", new Date(now.getTime() - 1800_001)), /目前不在可報到時間內/);
});
