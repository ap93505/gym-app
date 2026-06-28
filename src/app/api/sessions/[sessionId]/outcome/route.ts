import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { incompleteReasons } from "@/lib/domain/types";
import { apiError } from "@/lib/http";
import { confirmOutcome } from "@/lib/services/sessions";

const schema = z.object({
  outcome: z.enum(["completed", "not_completed"]),
  reason: z.enum(incompleteReasons).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin", "coach"]);
    const { sessionId } = await context.params;
    const input = schema.parse(await request.json());
    await confirmOutcome(principal, sessionId, input.outcome, input.reason, input.note);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
