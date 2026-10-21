import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { addBatchMember, voidCreditBatch } from "@/lib/services/creditBatches";

type Context = { params: Promise<{ userId: string; batchId: string }> };
const memberSchema = z.object({ memberId: z.string().min(1).refine((id) => !id.includes("/")) });
const voidSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { userId, batchId } = await context.params;
    const { memberId } = memberSchema.parse(await request.json());
    await addBatchMember(principal, userId, batchId, memberId);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { userId, batchId } = await context.params;
    const { reason } = voidSchema.parse(await request.json());
    await voidCreditBatch(principal, userId, batchId, reason);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
