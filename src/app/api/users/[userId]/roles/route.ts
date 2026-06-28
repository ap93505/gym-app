import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { roles } from "@/lib/domain/types";
import { updateUserRoles } from "@/lib/services/users";

const schema = z.object({ roles: z.array(z.enum(roles)).min(1) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { userId } = await context.params;
    const input = schema.parse(await request.json());
    await updateUserRoles(principal.userId, userId, input.roles);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
