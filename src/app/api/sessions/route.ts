import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { createSessions, listSessions } from "@/lib/services/sessions";

const createSchema = z.object({
  studentId: z.string().min(1),
  coachId: z.string().min(1),
  startAt: z.coerce.date(),
  recurrence: z.object({
    frequency: z.enum(["none", "daily", "weekly", "monthly"]),
    count: z.number().int().positive().optional(),
    endAt: z.coerce.date().optional(),
  }),
});

export async function GET(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal();
    const from = new Date(request.nextUrl.searchParams.get("from") ?? "");
    const to = new Date(request.nextUrl.searchParams.get("to") ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: { message: "查詢日期無效" } }, { status: 400 });
    }
    const mineOnly = request.nextUrl.searchParams.get("scope") === "mine";
    return NextResponse.json({ sessions: await listSessions(from, to, principal, mineOnly) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal(["admin", "coach"]);
    const input = createSchema.parse(await request.json());
    const result = await createSessions(principal, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
