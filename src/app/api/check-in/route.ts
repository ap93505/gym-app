import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyCheckInQrToken } from "@/lib/auth/checkInQr";
import { requireApiPrincipal } from "@/lib/auth/session";
import { assert } from "@/lib/domain/errors";
import { getAppUrl } from "@/lib/env";
import { apiError } from "@/lib/http";
import { checkIn, eligibleCheckins } from "@/lib/services/sessions";

const inputSchema = z.object({ token: z.string().min(1).max(2048), sessionId: z.string().min(1).max(128).regex(/^[^/]+$/).optional() }).strict();

// POST keeps the QR token out of API query strings. A missing sessionId only lists courses.
export async function POST(request: NextRequest) {
  try {
    assert(request.headers.get("origin") === new URL(getAppUrl()).origin, "請從本站進行報到", 403, "FORBIDDEN");
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    assert(parsed.success, "報到資料不完整，請重新掃描 QR Code");
    const { token, sessionId } = parsed.data;
    const { expiresAt } = await verifyCheckInQrToken(token);
    const principal = await requireApiPrincipal();
    if (sessionId) {
      await checkIn(principal, sessionId);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const sessions = await eligibleCheckins(principal.userId, true);
    return NextResponse.json({ sessions, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
