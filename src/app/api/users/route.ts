import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listUsers } from "@/lib/services/users";
import { z } from "zod";
import { roles } from "@/lib/domain/types";

export async function GET(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal(["admin", "coach"]);
    const role = z.enum(roles).optional().parse(request.nextUrl.searchParams.get("role") ?? undefined);
    return NextResponse.json({ users: await listUsers(principal, role) });
  } catch (error) {
    return apiError(error);
  }
}
