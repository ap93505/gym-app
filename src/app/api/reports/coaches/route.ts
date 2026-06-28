import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { coachReport } from "@/lib/services/reports";

export async function GET(request: NextRequest) {
  try {
    await requireApiPrincipal(["admin"]);
    const from = new Date(request.nextUrl.searchParams.get("from") ?? ""); const to = new Date(request.nextUrl.searchParams.get("to") ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: { message: "日期範圍無效" } }, { status: 400 });
    return NextResponse.json({ rows: await coachReport(from, to) });
  } catch (error) { return apiError(error); }
}
