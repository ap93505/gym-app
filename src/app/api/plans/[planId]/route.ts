import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { updatePlan } from "@/lib/services/plans";

const schema = z.object({ name: z.string().trim().min(1).max(100), sessions: z.number().int().positive().max(1000), price: z.number().int().nonnegative(), active: z.boolean() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ planId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin"]); const { planId } = await context.params;
    await updatePlan(principal.userId, planId, schema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
