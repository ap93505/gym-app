"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMemberDate, formatMemberDateTime, type SessionItem } from "./MemberSchedule";

type CheckInSession = SessionItem & { canCheckIn: boolean; checkInOpensAt: string };

export function CheckInPanelV2() {
  const [sessions, setSessions] = useState<CheckInSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/sessions/check-in-eligible", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) setError(body.error?.message ?? "讀取課程失敗");
    else setSessions(body.sessions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/sessions/check-in-eligible", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "讀取課程失敗");
        setSessions(body.sessions ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "讀取課程失敗"))
      .finally(() => setLoading(false));
  }, []);

  async function checkIn(id: string) {
    setMessage("");
    const response = await fetch(`/api/sessions/${id}/check-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const body = await response.json();
    setMessage(response.ok ? "報到完成，請安心上課。" : body.error?.message ?? "報到失敗");
    if (response.ok) await load();
  }

  if (loading) return <div className="card">正在讀取你的課程…</div>;
  return (
    <div className="stack">
      {error && <div className="notice error">{error}</div>}
      {message && <div className={message.includes("失敗") ? "notice error" : "notice"}>{message}</div>}
      {!sessions.length && <div className="card"><h3>目前沒有已預約課程</h3><p className="muted">建立預約後，可報到及即將到來的課程都會顯示在此。</p></div>}
      {sessions.map((session) => (
        <article className="card stack" key={session.id}>
          <div>
            <span className={`badge ${session.canCheckIn ? "" : "warn"}`}>{session.canCheckIn ? "現在可報到" : "即將到來"}</span>
            <h2 style={{ marginTop: 12 }}>上課時間：{formatMemberDate(session.startAt)}</h2>
            <p className="muted">可打卡時間：{formatMemberDateTime(session.checkInOpensAt)} ～ {formatMemberDateTime(session.endAt)}<br />教練：{session.coachName} ・ 一小時課程</p>
          </div>
          {!session.canCheckIn && <div className="notice">報到將於 {formatMemberDateTime(session.checkInOpensAt)} 開放。</div>}
          <div className="form-actions"><button className="button" disabled={!session.canCheckIn} onClick={() => checkIn(session.id)}>確認報到</button></div>
        </article>
      ))}
    </div>
  );
}
