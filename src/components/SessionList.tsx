"use client";

import { useEffect, useState } from "react";

export type SessionItem = {
  id: string; studentId: string; coachId: string; studentName: string; coachName: string; startAt: string; endAt: string; status: string;
  checkedInAt?: string; incompleteReason?: string; incompleteNote?: string;
};

const statusLabels: Record<string, string> = {
  scheduled: "已預約", checked_in: "已報到", completed: "已完成", not_completed: "未完成", cancelled: "已取消",
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }).format(new Date(value));
}

export function SessionRows({ sessions }: { sessions: SessionItem[] }) {
  return <div className="session-list">{sessions.map((session) => (
    <article className={`session-row status-${session.status}`} key={session.id}>
      <strong>{formatDate(session.startAt)}</strong>
      <div><div>{session.coachName} × {session.studentName}</div><span className={`badge status-${session.status}`}>{statusLabels[session.status] ?? session.status}</span></div>
      <a className="button secondary small" href={`/api/sessions/${session.id}/ics`}>加入行事曆</a>
    </article>
  ))}</div>;
}

export function MemberCalendar() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const from = new Date(); from.setDate(from.getDate() - 7);
    const to = new Date(); to.setMonth(to.getMonth() + 3);
    fetch(`/api/sessions?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((response) => response.json()).then((body) => setSessions(body.sessions ?? [])).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="card">載入預約中…</div>;
  if (!sessions.length) return <div className="card"><h3>目前沒有預約</h3><p className="muted">新增課程後會顯示在這裡。</p></div>;
  return <SessionRows sessions={sessions} />;
}
