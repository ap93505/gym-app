import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listCoaches } from "@/lib/services/cooperatingCoaches";

export async function GET() {
  try {
    await requireApiPrincipal();
    return NextResponse.json({ coaches: await listCoaches() });
  } catch (error) { return apiError(error); }
}
