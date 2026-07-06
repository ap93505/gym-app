import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { reorderPlans } from "@/lib/services/plans";

const schema = z.object({ planIds: z.array(z.string().min(1)).min(1) });

export async function PATCH(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { planIds } = schema.parse(await request.json());
    await reorderPlans(principal.userId, planIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
