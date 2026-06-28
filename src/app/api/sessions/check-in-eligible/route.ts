import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { eligibleCheckins } from "@/lib/services/sessions";

export async function GET() {
  try {
    const principal = await requireApiPrincipal();
    return NextResponse.json({ sessions: await eligibleCheckins(principal.userId) });
  } catch (error) {
    return apiError(error);
  }
}
