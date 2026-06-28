import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { pendingConfirmations } from "@/lib/services/sessions";

export async function GET() {
  try {
    const principal = await requireApiPrincipal(["admin", "coach"]);
    return NextResponse.json({ sessions: await pendingConfirmations(principal) });
  } catch (error) {
    return apiError(error);
  }
}
