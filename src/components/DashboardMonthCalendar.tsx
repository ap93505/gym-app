"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhTwLocale from "@fullcalendar/core/locales/zh-tw";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { Modal } from "./Modal";
import { formatMemberDate, type SessionItem } from "./MemberSchedule";
import { sessionStatusColor, sessionStatusLabels } from "@/lib/domain/sessionPresentation";

export function DashboardMonthCalendar() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selected, setSelected] = useState<SessionItem | null>(null);
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
    setError("");
    const response = await fetch(`/api/sessions?from=${info.start.toISOString()}&to=${info.end.toISOString()}`, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setSessions(body.sessions ?? []);
    else setError(body.error?.message ?? "月份行事曆載入失敗");
  }

  return <>
    <section className="card" style={{ marginTop: 18 }}>
      <div className="page-heading"><div><h3>預約課程</h3><p className="muted">預設顯示今天，可切換日、週或月檢視。</p></div></div>
      {error && <div className="notice error">{error}</div>}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={zhTwLocale}
        initialView="timeGridDay"
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth" }}
        buttonText={{ today: "今天", day: "日", week: "週", month: "月" }}
        allDaySlot={false}
        slotDuration="01:00:00"
        slotMinTime="10:00:00"
        slotMaxTime="22:00:00"
        scrollTime="10:00:00"
        nowIndicator
        events={events}
        eventClick={(info: EventClickArg) => setSelected(info.event.extendedProps.session as SessionItem)}
        datesSet={(info: DatesSetArg) => void load(info)}
        dayMaxEvents={3}
        fixedWeekCount={false}
        height="auto"
      />
    </section>
    <Modal open={!!selected} title="課程資訊" onClose={() => setSelected(null)}>
      {selected && <div><h3>{formatMemberDate(selected.startAt)}</h3><p>教練：{selected.coachName}<br />學生：{selected.studentName}</p><span className={`badge status-${selected.status}`}>{sessionStatusLabels[selected.status] ?? selected.status}</span></div>}
    </Modal>
  </>;
}
