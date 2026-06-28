"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, type SessionItem } from "./SessionList";

function localInput(value: string) {
  const date = new Date(value); const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
function hue(id: string) { return [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % 360; }
const labels: Record<string, string> = { scheduled: "已預約", checked_in: "已報到", completed: "已完成", not_completed: "未完成", cancelled: "已取消" };

export function StaffSessionRows({ sessions, reload }: { sessions: SessionItem[]; reload: () => void }) {
  const [me, setMe] = useState<{ id: string; roles: string[] } | null>(null); const [edits, setEdits] = useState<Record<string, string>>({}); const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then((b) => setMe(b.user)); }, []);
  const counts = useMemo(() => sessions.reduce<Record<string, number>>((map, session) => { if (!session.status.includes("cancel")) map[session.startAt] = (map[session.startAt] ?? 0) + 1; return map; }, {}), [sessions]);
  async function save(session: SessionItem) {
    const startAt = new Date(edits[session.id] ?? localInput(session.startAt));
    const response = await fetch(`/api/sessions/${session.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId: session.studentId, coachId: session.coachId, startAt: startAt.toISOString() }) });
    const body = await response.json(); setMessage(response.ok ? "課程時間已更新" : body.error?.message ?? "更新失敗"); if (response.ok) reload();
  }
  async function cancel(session: SessionItem) {
    const reason = window.prompt("請輸入取消原因"); if (!reason?.trim()) return;
    const response = await fetch(`/api/sessions/${session.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    const body = await response.json(); setMessage(response.ok ? "課程已取消並釋放堂數" : body.error?.message ?? "取消失敗"); if (response.ok) reload();
  }
  return <div className="stack">{message && <div className="notice">{message}</div>}<div className="session-list">{sessions.map((session) => {
    const canEdit = session.status === "scheduled" && new Date(session.startAt) > new Date() && !!me && (me.roles.includes("admin") || (me.roles.includes("coach") && me.id === session.coachId));
    return <article className={`session-row status-${session.status}`} style={{ borderLeft: `5px solid hsl(${hue(session.coachId)} 28% 58%)` }} key={session.id}>
      <div><strong>{formatDate(session.startAt)}</strong><div className="muted">同時段 {counts[session.startAt] ?? 0} / 3 組</div></div>
      <div><div>{session.coachName} × {session.studentName}</div><span className={`badge status-${session.status}`}>{labels[session.status]}</span></div>
      <div className="actions">{canEdit && <><input className="input" style={{ width: 205 }} type="datetime-local" value={edits[session.id] ?? localInput(session.startAt)} onChange={(e) => setEdits({ ...edits, [session.id]: e.target.value })} /><button className="button secondary small" onClick={() => save(session)}>改期</button></>}{canEdit && me?.roles.includes("admin") && <button className="button danger small" onClick={() => cancel(session)}>取消</button>}</div>
    </article>;
  })}</div></div>;
}
