import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { checkIn } from "@/lib/services/sessions";

const schema = z.object({ studentId: z.string().optional() });

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const principal = await requireApiPrincipal();
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = schema.parse(body);
    await checkIn(principal, sessionId, input.studentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
