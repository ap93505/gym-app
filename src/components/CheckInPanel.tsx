"use client";

import { useEffect, useState } from "react";

type Session = { id: string; coachName: string; startAt: string; endAt: string; status: string };

function time(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Taipei" }).format(new Date(value));
}

export function CheckInPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    const response = await fetch("/api/sessions/check-in-eligible", { cache: "no-store" });
    const body = await response.json();
    setSessions(body.sessions ?? []); setLoading(false);
  }
  useEffect(() => {
    fetch("/api/sessions/check-in-eligible", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setSessions(body.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);
  async function checkIn(id: string) {
    setMessage("");
    const response = await fetch(`/api/sessions/${id}/check-in`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const body = await response.json();
    setMessage(response.ok ? `您已於 ${time(new Date().toISOString())} 完成報到。` : body.error?.message ?? "報到失敗");
    if (response.ok) await load();
  }
  if (loading) return <div className="card">正在確認目前課程…</div>;
  return (
    <div className="stack">
      {message && <div className={message.includes("失敗") ? "notice error" : "notice"}>{message}</div>}
      {sessions.length === 0 ? (
        <div className="card"><h3>目前沒有可報到課程</h3><p className="muted">報到時間為課程開始前 30 分鐘至課程結束。</p></div>
      ) : sessions.map((session) => (
        <div className="card" key={session.id}>
          <p className="eyebrow">Ready to check in</p><h2>{time(session.startAt)}</h2>
          <p className="muted">教練：{session.coachName} ・ 一小時課程</p>
          <button className="button" onClick={() => checkIn(session.id)}>確認報到</button>
        </div>
      ))}
    </div>
  );
}
