import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "ray-gym", time: new Date().toISOString() });
}
