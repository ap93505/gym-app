import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { createPlan, listPlans } from "@/lib/services/plans";

const schema = z.object({ name: z.string().trim().min(1).max(100), sessions: z.number().int().positive().max(1000), price: z.number().int().nonnegative(), active: z.boolean() });

export async function GET(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal();
    const activeOnly = !principal.roles.includes("admin") || request.nextUrl.searchParams.get("active") === "true";
    return NextResponse.json({ plans: await listPlans(activeOnly) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const input = schema.parse(await request.json());
    return NextResponse.json({ id: await createPlan(principal.userId, input) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
