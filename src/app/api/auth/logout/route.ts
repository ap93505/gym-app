import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { getAppUrl } from "@/lib/env";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", getAppUrl()), 303);
}
