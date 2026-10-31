import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getUser, updateOwnProfile } from "@/lib/services/users";

const profileSchema = z.object({
  realName: z.string().trim().min(1, "請填寫本名").max(50),
  nickname: z.string().trim().min(1, "請填寫綽號").max(50),
  cooperatingCoachIds: z.array(z.string().min(1).refine((id) => !id.includes("/"))).min(1).max(50).optional(),
});

export async function GET() {
  try {
    const principal = await requireApiPrincipal();
    return NextResponse.json({ user: await getUser(principal.userId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal();
    const input = profileSchema.parse(await request.json());
    const profile = await updateOwnProfile(principal.userId, input.realName, input.nickname, input.cooperatingCoachIds);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return apiError(error);
  }
}
