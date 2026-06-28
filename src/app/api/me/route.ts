import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getUser, updateOwnProfile } from "@/lib/services/users";

const profileSchema = z.object({
  realName: z.string().trim().min(1, "請填寫本名").max(50),
  nickname: z.string().trim().min(1, "請填寫綽號").max(50),
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
    await updateOwnProfile(principal.userId, input.realName, input.nickname);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
