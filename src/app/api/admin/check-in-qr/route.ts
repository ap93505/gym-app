import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireApiPrincipal } from "@/lib/auth/session";
import { createCheckInQrToken, QR_REFRESH_SECONDS } from "@/lib/auth/checkInQr";
import { getAppUrl } from "@/lib/env";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    await requireApiPrincipal(["admin"]);
    const { token, expiresAt } = await createCheckInQrToken();
    const url = new URL("/check-in", getAppUrl());
    url.searchParams.set("token", token);
    const image = await QRCode.toDataURL(url.toString(), { width: 640, margin: 4, errorCorrectionLevel: "M" });
    return NextResponse.json({ image, expiresAt, refreshAfterSeconds: QR_REFRESH_SECONDS }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
