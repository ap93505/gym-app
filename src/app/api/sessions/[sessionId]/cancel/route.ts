import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { cancelSession } from "@/lib/services/sessions";

const schema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { sessionId } = await context.params;
    const input = schema.parse(await request.json());
    await cancelSession(principal, sessionId, input.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
