"use client";

import { useEffect, useState } from "react";

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

const statusLabels: Record<string, string> = {
  scheduled: "已預約",
  checked_in: "已報到",
  completed: "已完成",
  not_completed: "未完成",
  cancelled: "已取消",
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

export function MemberSessionRows({ sessions }: { sessions: SessionItem[] }) {
  return (
    <div className="session-list">
      {sessions.map((session) => (
        <article className={`session-row status-${session.status}`} key={session.id}>
          <strong>{formatMemberDate(session.startAt)}</strong>
          <div>
            <div>教練: {session.coachName} - 學生: {session.studentName}</div>
            <span className={`badge status-${session.status}`}>
              {statusLabels[session.status] ?? session.status}
            </span>
          </div>
          <a className="button secondary small" href={`/api/sessions/${session.id}/ics`}>加入行事曆</a>
        </article>
      ))}
    </div>
  );
}

export function MemberSchedule() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    to.setMonth(to.getMonth() + 3);
    fetch(`/api/sessions?from=${from.toISOString()}&to=${to.toISOString()}&scope=mine`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "載入預約失敗");
        setSessions(body.sessions ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "載入預約失敗"))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="card">載入預約中…</div>;
  if (error) return <div className="notice error">{error}</div>;
  if (!sessions.length) return <div className="card"><h3>目前沒有預約</h3><p className="muted">新增課程後會顯示在這裡。</p></div>;
  return <MemberSessionRows sessions={sessions} />;
}
