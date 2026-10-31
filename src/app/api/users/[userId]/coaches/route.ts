import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { updateCooperatingCoaches } from "@/lib/services/cooperatingCoaches";

const schema = z.object({ cooperatingCoachIds: z.array(z.string().min(1).refine((id) => !id.includes("/"))).min(1).max(50) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin", "student"]);
    const { userId } = await context.params;
    const input = schema.parse(await request.json());
    const ids = await updateCooperatingCoaches(principal, userId, input.cooperatingCoachIds);
    return NextResponse.json({ ok: true, cooperatingCoachIds: ids });
  } catch (error) { return apiError(error); }
}
