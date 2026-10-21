import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { MAX_SLOT_CAPACITY } from "@/lib/domain/scheduling";
import { getSchedulingSettings, updateSchedulingSettings } from "@/lib/services/settings";

const schema = z.object({ slotCapacity: z.number().int().min(1).max(MAX_SLOT_CAPACITY) });

export async function GET() {
  try {
    await requireApiPrincipal(["admin"]);
    return NextResponse.json(await getSchedulingSettings());
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const principal = await requireApiPrincipal(["admin"]);
    const { slotCapacity } = schema.parse(await request.json());
    return NextResponse.json(await updateSchedulingSettings(principal, slotCapacity));
  } catch (error) { return apiError(error); }
}
