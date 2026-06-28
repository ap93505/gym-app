import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listUsers } from "@/lib/services/users";
import type { Role } from "@/lib/domain/types";

export async function GET(request: NextRequest) {
  try {
    await requireApiPrincipal(["admin", "coach"]);
    const role = request.nextUrl.searchParams.get("role") as Role | null;
    return NextResponse.json({ users: await listUsers(role ?? undefined) });
  } catch (error) {
    return apiError(error);
  }
}
