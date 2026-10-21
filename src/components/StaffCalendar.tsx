"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable, type DateClickArg, type EventReceiveArg } from "@fullcalendar/interaction";
import zhTwLocale from "@fullcalendar/core/locales/zh-tw";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { Modal } from "./Modal";
import { formatMemberDate, type SessionItem } from "./MemberSchedule";
import { BookingDateTimePicker } from "./BookingDateTimePicker";
import { CalendarStatusLegend } from "./CalendarStatusLegend";
import { calendarDayTitleFormat, useCalendarSwipe } from "./calendarInteractions";
import { sessionStatusColor } from "@/lib/domain/sessionPresentation";

type UserOption = {
  id: string;
  displayName: string;
  realName: string;
  nickname: string;
  roles: string[];
  credits: { available: number; plans: Array<{ planId: string; planName: string; sharedRemaining: number; totalRemaining: number; reserved: number; available: number }> };
};

type SessionDraft = {
  id?: string;
  studentId: string;
  coachId: string;
  planId: string;
  startLocal: string;
  frequency: "none" | "daily" | "weekly" | "monthly";
  count: number;
};

type SlotAvailability = { startAt: string; count: number; capacity: number };

const statusLabels: Record<string, string> = {
  scheduled: "已預約",
  checked_in: "已報到",
  completed: "已完成",
  not_completed: "未完成",
  cancelled: "已取消",
};

function userName(user?: UserOption) {
  return user?.realName || user?.nickname || user?.displayName || "尚未選擇";
}

function localInput(value: Date | string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function nextHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  if (date.getHours() < 6) date.setHours(6, 0, 0, 0);
  return localInput(date);
}

function taipeiToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function recurrenceEnd(startLocal: string, frequency: SessionDraft["frequency"], count: number) {
  const start = new Date(startLocal);
  if (frequency === "none" || count <= 1) return start;
  const end = new Date(start);
  if (frequency === "daily") end.setDate(end.getDate() + count - 1);
  if (frequency === "weekly") end.setDate(end.getDate() + (count - 1) * 7);
  if (frequency === "monthly") {
    const originalDay = end.getDate();
    end.setDate(1);
    end.setMonth(end.getMonth() + count - 1);
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    end.setDate(Math.min(originalDay, lastDay));
  }
  return end;
}

export function StaffCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const swipeHandlers = useCalendarSwipe(calendarRef);
  const draggableRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef({ start: new Date(), end: new Date() });
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);
  const [students, setStudents] = useState<UserOption[]>([]);
  const [coaches, setCoaches] = useState<UserOption[]>([]);
  const [me, setMe] = useState<UserOption | null>(null);
  const [studentId, setStudentId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [planId, setPlanId] = useState("");
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [selected, setSelected] = useState<SessionItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [today] = useState(taipeiToday);

  const isAdmin = me?.roles.includes("admin") ?? false;
  const selectedStudent = students.find((user) => user.id === (draft?.studentId ?? studentId));
  const selectedCoach = coaches.find((user) => user.id === coachId);
  const selectedPlan = selectedStudent?.credits.plans.find((plan) => plan.planId === (draft?.planId ?? planId));
  const validPair = !!studentId && !!coachId && !!planId && studentId !== coachId && (selectedPlan?.available ?? 0) > 0;
  const validDraftPair = !!draft?.studentId && !!draft.coachId && !!draft.planId && draft.studentId !== draft.coachId;
  const maxCount = Math.min(selectedPlan?.available ?? 0, 100);
  const recurrenceEndDate = draft ? recurrenceEnd(draft.startLocal, draft.frequency, draft.count) : null;

  const load = useCallback(async (start = rangeRef.current.start, end = rangeRef.current.end) => {
    const response = await fetch(`/api/sessions?from=${start.toISOString()}&to=${end.toISOString()}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) setMessage(body.error?.message ?? "行事曆載入失敗");
    else {
      setSessions(body.sessions ?? []);
      setSlots(body.slots ?? []);
    }
  }, []);

  const refreshStudents = useCallback(async () => {
    const response = await fetch("/api/users?role=student", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setStudents(body.users ?? []);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/me", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/users?role=student", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/users?role=coach", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([meBody, studentBody, coachBody]) => {
      const current = meBody.user as UserOption;
      setMe(current);
      setStudents(studentBody.users ?? []);
      setCoaches(coachBody.users ?? []);
      if (current?.roles.includes("coach") && !current?.roles.includes("admin")) setCoachId(current.id);
    });
  }, []);

  useEffect(() => {
    if (!draggableRef.current || !validPair) return;
    const draggable = new Draggable(draggableRef.current, {
      itemSelector: ".draggable-pair",
      eventData: {
        title: `教練: ${userName(selectedCoach)} - 學生: ${userName(students.find((user) => user.id === studentId))} - 方案: ${selectedPlan?.planName}`,
        duration: "01:00",
      },
      longPressDelay: 350,
      minDistance: 5,
    });
    return () => draggable.destroy();
  }, [coachId, selectedCoach, selectedPlan?.planName, studentId, students, validPair]);

  const calendarEvents = useMemo(() => sessions.map((session) => ({
    id: session.id,
    title: `${session.coachName} - ${session.studentName}`,
    start: session.startAt,
    end: session.endAt,
    backgroundColor: sessionStatusColor(session.status),
    borderColor: sessionStatusColor(session.status),
    classNames: [`event-${session.status}`],
    extendedProps: { session },
  })), [sessions]);

  const availabilityEvents = useMemo(() => {
    if (!visibleRange) return [];
    const counts = new Map(slots.map((slot) => [new Date(slot.startAt).getTime(), slot.count]));
    const events = [];
    const cursor = new Date(visibleRange.start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor < visibleRange.end) {
      for (let hour = 6; hour < 24; hour += 1) {
        const start = new Date(cursor);
        start.setHours(hour, 0, 0, 0);
        const count = counts.get(start.getTime()) ?? 0;
        const state = count >= 3 ? "full" : count === 2 ? "limited" : "available";
        events.push({
          id: `availability-${start.getTime()}`,
          start,
          end: new Date(start.getTime() + 60 * 60 * 1000),
          display: "background",
          classNames: [`slot-${state}`],
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return events;
  }, [slots, visibleRange]);

  function openCreate(start = new Date()) {
    setDraft({ studentId, coachId, planId, startLocal: localInput(start), frequency: "none", count: 1 });
    setSelected(null); setEditing(true); setCancelling(false); setMessage("");
  }

  function receive(info: EventReceiveArg) {
    const start = info.event.start;
    info.revert();
    if (start) openCreate(start);
  }

  function dateClick(info: DateClickArg) {
    if (!info.allDay) openCreate(info.date);
  }

  function eventClick(info: EventClickArg) {
    setSelected(info.event.extendedProps.session as SessionItem);
    setDraft(null); setEditing(false); setCancelling(false); setCancelReason(""); setMessage("");
  }

  function beginEdit() {
    if (!selected) return;
    setDraft({ id: selected.id, studentId: selected.studentId, coachId: selected.coachId, planId: selected.planId, startLocal: localInput(selected.startAt), frequency: "none", count: 1 });
    setEditing(true); setMessage("");
  }

  async function saveSession(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (draft.studentId === draft.coachId) {
      setMessage("教練與學生不可為同一人");
      return;
    }
    setSaving(true); setMessage("");
    const payload = {
      studentId: draft.studentId,
      coachId: draft.coachId,
      planId: draft.planId,
      startAt: new Date(draft.startLocal).toISOString(),
      ...(draft.id ? {} : { recurrence: { frequency: draft.frequency, ...(draft.frequency === "none" ? {} : { count: draft.count }) } }),
    };
    const response = await fetch(draft.id ? `/api/sessions/${draft.id}` : "/api/sessions", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (response.ok) {
      setDraft(null); setSelected(null); setEditing(false); await Promise.all([load(), refreshStudents()]);
    } else {
      const details = Array.isArray(body.error?.details) ? `：${body.error.details.join("、")}` : "";
      setMessage(`${body.error?.message ?? "儲存失敗"}${details}`);
    }
    setSaving(false);
  }

  async function cancelSession() {
    if (!selected || !cancelReason.trim()) return;
    setSaving(true); setMessage("");
    const response = await fetch(`/api/sessions/${selected.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: cancelReason }),
    });
    const body = await response.json();
    if (response.ok) { setSelected(null); setCancelling(false); await Promise.all([load(), refreshStudents()]); }
    else setMessage(body.error?.message ?? "取消失敗");
    setSaving(false);
  }

  const canEditSelected = !!selected && selected.status === "scheduled" && !!me && (isAdmin || (me.roles.includes("coach") && me.id === selected.coachId));

  return <>
    {message && !selected && !draft && <div className="notice error" style={{ marginBottom: 16 }}>{message}</div>}
    <div className="calendar-workspace">
      <aside className="card stack calendar-sidebar">
        <div><h3>建立預約</h3><p className="muted">選擇教練與學生，再將配對方塊拖曳到右側時段。</p></div>
        <div className="field"><label>學生</label><select className="input" value={studentId} onChange={(event) => { setStudentId(event.target.value); setPlanId(""); }}><option value="">請選擇</option>{students.map((user) => <option key={user.id} value={user.id} disabled={user.id === coachId}>{userName(user)}（可預約 {user.credits.available}）</option>)}</select></div>
        <div className="field"><label>教練</label><select className="input" value={coachId} onChange={(event) => setCoachId(event.target.value)} disabled={!isAdmin}><option value="">請選擇</option>{coaches.map((user) => <option key={user.id} value={user.id} disabled={user.id === studentId}>{userName(user)}</option>)}</select></div>
        <div className="field"><label>方案</label><select className="input" value={planId} onChange={(event) => setPlanId(event.target.value)} disabled={!studentId}><option value="">請選擇方案</option>{selectedStudent?.credits.plans.map((plan) => <option key={plan.planId} value={plan.planId} disabled={plan.available < 1}>{plan.planName}{plan.sharedRemaining > 0 ? "（含共用）" : ""}｜剩餘 {plan.totalRemaining}｜已預約 {plan.reserved}｜可預約 {plan.available}</option>)}</select></div>
        <div ref={draggableRef}>{validPair ? <div className="draggable-pair">教練: {userName(selectedCoach)} - 學生: {userName(students.find((user) => user.id === studentId))}<div style={{ fontWeight: 400, marginTop: 6 }}>方案: {selectedPlan?.planName}（可預約 {selectedPlan?.available} 堂）</div><div style={{ fontWeight: 400, marginTop: 6 }}>拖曳至一小時時段</div></div> : <div className={`notice ${studentId && coachId && studentId === coachId ? "error" : ""}`}>{studentId && coachId && studentId === coachId ? "教練與學生不可為同一人。" : "請先完成教練、學生與方案選擇。"}</div>}</div>
        <button className="button secondary" onClick={() => openCreate(new Date(nextHour()))}>使用表單新增</button>
      </aside>
      <section className="card calendar-card">
        <CalendarStatusLegend />
        <div className="slot-capacity-legend" aria-label="時段預約容量">
          <span><i className="slot-available" />可預約</span>
          <span><i className="slot-limited" />剩 1 組</span>
          <span><i className="slot-full" />已額滿</span>
        </div>
        <div className="calendar-swipe-surface" {...swipeHandlers}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={zhTwLocale}
          initialView="timeGridDay"
          views={{ timeGridDay: { titleFormat: calendarDayTitleFormat } }}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "今天", month: "月", week: "週", day: "日" }}
          allDaySlot={false}
          slotDuration="01:00:00"
          snapDuration="01:00:00"
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          scrollTime="06:00:00"
          nowIndicator
          selectable
          droppable
          eventLongPressDelay={350}
          selectLongPressDelay={350}
          editable={false}
          events={[...availabilityEvents, ...calendarEvents]}
          eventReceive={receive}
          dateClick={dateClick}
          eventClick={eventClick}
          datesSet={(info: DatesSetArg) => { rangeRef.current = { start: info.start, end: info.end }; setVisibleRange({ start: info.start, end: info.end }); void load(info.start, info.end); }}
          height="auto"
        />
        </div>
      </section>
    </div>

    <Modal open={!!draft && editing} title={draft?.id ? "編輯課程" : "建立課程"} onClose={() => { setDraft(null); setEditing(false); }} wide>
      {draft && <form className="stack" onSubmit={saveSession}>
        <div className="form-grid">
          <div className="field"><label>學生</label><select className="input" value={draft.studentId} onChange={(event) => setDraft({ ...draft, studentId: event.target.value, planId: "", count: 1 })} required><option value="">請選擇</option>{students.map((user) => <option key={user.id} value={user.id} disabled={user.id === draft.coachId}>{userName(user)}（可預約 {user.credits.available}）</option>)}</select></div>
          <div className="field"><label>教練</label><select className="input" value={draft.coachId} onChange={(event) => setDraft({ ...draft, coachId: event.target.value })} disabled={!isAdmin} required><option value="">請選擇</option>{coaches.map((user) => <option key={user.id} value={user.id} disabled={user.id === draft.studentId}>{userName(user)}</option>)}</select></div>
          <div className="field"><label>方案</label><select className="input" value={draft.planId} onChange={(event) => setDraft({ ...draft, planId: event.target.value, count: 1 })} required><option value="">請選擇方案</option>{selectedStudent?.credits.plans.map((plan) => <option key={plan.planId} value={plan.planId} disabled={plan.available < 1 && plan.planId !== selected?.planId}>{plan.planName}{plan.sharedRemaining > 0 ? "（含共用）" : ""}｜剩餘 {plan.totalRemaining}｜已預約 {plan.reserved}｜可預約 {plan.available}</option>)}</select></div>
          <div className="field"><label>課程日期與時段</label><BookingDateTimePicker value={draft.startLocal} onChange={(startLocal) => setDraft({ ...draft, startLocal })} minDate={isAdmin ? undefined : today} /><span className="muted field-hint">{isAdmin ? "Admin 可建立任意日期的課程。" : "教練可建立今天或之後的課程。"}</span></div>
          {!draft.id && <div className="field"><label>循環</label><select className="input" value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as SessionDraft["frequency"], count: 1 })}><option value="none">不重複</option><option value="daily">每日</option><option value="weekly">每週</option><option value="monthly">每月</option></select></div>}
        </div>
        {!draft.id && draft.frequency !== "none" && <><div className="field"><label>循環次數（目前最多 {maxCount} 次）</label><input className="input" type="number" min="1" max={maxCount || 1} value={draft.count} onChange={(event) => setDraft({ ...draft, count: Number(event.target.value) })} /></div>{recurrenceEndDate && <div className="notice">共 {draft.count} 堂，最後一堂：{formatMemberDate(recurrenceEndDate.toISOString())}；建立後尚可預約 {Math.max(0, maxCount - draft.count)} 堂。</div>}</>}
        {message && <div className="notice error">{message}</div>}
        <div className="form-actions"><button className="button" disabled={saving || !validDraftPair || (!draft.id && draft.count > maxCount)}>{saving ? "儲存中…" : "儲存"}</button><button type="button" className="button secondary" onClick={() => { setDraft(null); setEditing(false); }}>取消</button></div>
      </form>}
    </Modal>

    <Modal open={!!selected && !editing} title="課程資訊" onClose={() => setSelected(null)}>
      {selected && <div className="stack">
        <div><span className={`badge status-${selected.status}`}>{statusLabels[selected.status]}</span><h3 style={{ marginTop: 12 }}>{formatMemberDate(selected.startAt)}</h3><p>教練：{selected.coachName}<br />學生：{selected.studentName}<br />方案：{selected.planName}</p></div>
        {cancelling && <div className="field"><label>取消原因</label><textarea className="input" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} required /></div>}
        {message && <div className="notice error">{message}</div>}
        <div className="form-actions">
          {canEditSelected && !cancelling && <button className="button" onClick={beginEdit}>編輯</button>}
          {canEditSelected && isAdmin && !cancelling && <button className="button danger" onClick={() => setCancelling(true)}>取消課程</button>}
          {cancelling && <><button className="button danger" disabled={!cancelReason.trim() || saving} onClick={cancelSession}>確認取消</button><button className="button secondary" onClick={() => setCancelling(false)}>返回</button></>}
          <button className="button secondary" onClick={() => setSelected(null)}>關閉</button>
        </div>
      </div>}
    </Modal>
  </>;
}
