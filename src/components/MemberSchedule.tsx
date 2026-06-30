"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhTwLocale from "@fullcalendar/core/locales/zh-tw";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { Modal } from "./Modal";
import { CalendarStatusLegend } from "./CalendarStatusLegend";
import { sessionStatusColor, sessionStatusLabels } from "@/lib/domain/sessionPresentation";

export type SessionItem = {
  id: string;
  studentId: string;
  coachId: string;
  studentName: string;
  coachName: string;
  startAt: string;
  endAt: string;
  status: string;
  checkedInAt?: string;
  incompleteReason?: string;
  incompleteNote?: string;
};

export function formatMemberDate(value: string) {
  const date = new Date(value);
  const dateParts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    hour: "numeric",
    hour12: true,
  }).formatToParts(date);
  const part = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part(dateParts, "weekday").replace("週", "");
  return `${part(dateParts, "month")}/${part(dateParts, "day")}(${weekday}) ${part(timeParts, "dayPeriod").toUpperCase()} ${part(timeParts, "hour")}點`;
}

export function formatMemberDateTime(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday").replace("週", "");
  return `${part("month")}/${part("day")}(${weekday}) ${part("dayPeriod")} ${part("hour")}點${part("minute")}分`;
}

export function MemberSchedule() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selected, setSelected] = useState<SessionItem | null>(null);
  const [selectedAt, setSelectedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const events = useMemo(() => sessions.map((session) => ({
    id: session.id,
    title: `${session.coachName} - ${session.studentName}`,
    start: session.startAt,
    end: session.endAt,
    backgroundColor: sessionStatusColor(session.status),
    borderColor: sessionStatusColor(session.status),
    classNames: [`event-${session.status}`],
    extendedProps: { session },
  })), [sessions]);

  async function load(info: DatesSetArg) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/sessions?from=${info.start.toISOString()}&to=${info.end.toISOString()}&scope=mine`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "載入預約失敗");
      setSessions(body.sessions ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "載入預約失敗");
    } finally {
      setLoading(false);
    }
  }

  const canAddToCalendar = selected && new Date(selected.startAt).getTime() > selectedAt;

  return <>
    <section className="card stack member-calendar-card">
      <CalendarStatusLegend />
      {loading && <div className="muted">載入預約中…</div>}
      {error && <div className="notice error">{error}</div>}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={zhTwLocale}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        buttonText={{ today: "今天", month: "月", week: "週", day: "日" }}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="10:00:00"
        slotMaxTime="22:00:00"
        events={events}
        eventClick={(info: EventClickArg) => { setSelectedAt(Date.now()); setSelected(info.event.extendedProps.session as SessionItem); }}
        datesSet={(info: DatesSetArg) => void load(info)}
        dayMaxEvents={3}
        fixedWeekCount={false}
        height="auto"
      />
      {!loading && !error && !sessions.length && <div className="notice">這個區間目前沒有預約。</div>}
    </section>
    <Modal open={!!selected} title={selected ? formatMemberDate(selected.startAt) : "預約資訊"} onClose={() => setSelected(null)}>
      {selected && <div className="stack member-session-detail">
        <div className="member-session-copy">教練: {selected.coachName}<br />學生: {selected.studentName}</div>
        <div><span className={`badge status-${selected.status}`}>{sessionStatusLabels[selected.status] ?? selected.status}</span></div>
        <div className="form-actions">
          {canAddToCalendar && <a className="button" href={`/api/sessions/${selected.id}/ics`}>加入行事曆</a>}
          <button className="button secondary" onClick={() => setSelected(null)}>關閉</button>
        </div>
      </div>}
    </Modal>
  </>;
}
