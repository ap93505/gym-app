import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { updateSession } from "@/lib/services/sessions";

const schema = z.object({
  studentId: z.string().min(1),
  coachId: z.string().min(1),
  startAt: z.coerce.date(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin", "coach"]);
    const { sessionId } = await context.params;
    const input = schema.parse(await request.json());
    await updateSession(principal, sessionId, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
