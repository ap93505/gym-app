import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { grantPlanCredits } from "@/lib/services/users";

const schema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { userId } = await context.params;
    const input = schema.parse(await request.json());
    const result = await grantPlanCredits(principal.userId, userId, input.planId);
    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
