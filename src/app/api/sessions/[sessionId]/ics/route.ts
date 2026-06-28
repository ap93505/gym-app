import { NextResponse } from "next/server";
import { requireApiPrincipal } from "@/lib/auth/session";
import { AppError } from "@/lib/domain/errors";
import { db } from "@/lib/firebase/admin";
import { apiError } from "@/lib/http";

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const principal = await requireApiPrincipal();
    const { sessionId } = await context.params;
    const snapshot = await db.collection("sessions").doc(sessionId).get();
    if (!snapshot.exists) throw new AppError("找不到課程", 404, "SESSION_NOT_FOUND");
    const data = snapshot.data()!;
    const canRead = principal.roles.includes("admin") || principal.userId === data.studentId || principal.userId === data.coachId;
    if (!canRead) throw new AppError("沒有查看此課程的權限", 403, "FORBIDDEN");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//RAY Fitness//Gym Management//ZH-TW",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${sessionId}@ray-fitness`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(data.startAt.toDate())}`,
      `DTEND:${icsDate(data.endAt.toDate())}`,
      `SUMMARY:${escapeText(`私人教練課程｜${data.coachName}`)}`,
      `DESCRIPTION:${escapeText(`教練：${data.coachName}`)}`,
      `STATUS:${data.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    return new NextResponse(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="ray-session-${sessionId}.ics"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
