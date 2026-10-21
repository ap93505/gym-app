import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { grantPlanCredits } from "@/lib/services/users";
import { listCreditBatches } from "@/lib/services/creditBatches";

const schema = z.object({
  planId: z.string().min(1),
  sharedMemberIds: z.array(z.string().min(1).refine((id) => !id.includes("/"))).max(19).default([]),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { userId } = await context.params;
    return NextResponse.json({ batches: await listCreditBatches(principal, userId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { userId } = await context.params;
    const input = schema.parse(await request.json());
    const result = await grantPlanCredits(principal.userId, userId, input.planId, input.sharedMemberIds);
    return NextResponse.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
