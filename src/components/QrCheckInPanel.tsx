"use client";

import { useEffect, useRef, useState } from "react";
import { formatMemberDate, formatMemberTime, type SessionItem } from "./MemberSchedule";

export function QrCheckInPanel({ token, expiresAt, displayName }: { token: string; expiresAt: string; displayName: string }) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const returnTo = `/check-in?${new URLSearchParams({ token })}`;
  const loginUrl = `/api/auth/line/start?${new URLSearchParams({ returnTo })}`;

  useEffect(() => {
    const checkExpiry = () => setExpired(Date.now() >= Date.parse(expiresAt));
    checkExpiry();
    const timer = window.setInterval(checkExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) setNeedsLogin(true);
        if (response.status === 410) setExpired(true);
        if (!response.ok) throw new Error(body.error?.message ?? "讀取課程失敗");
        setSessions(body.sessions);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "讀取課程失敗，請重試。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [token, retry]);

  async function checkIn(session: SessionItem) {
    if (submitting.current || expired) return;
    submitting.current = true;
    setBusyId(session.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, sessionId: session.id }) });
      const body = await response.json();
      if (response.status === 401) setNeedsLogin(true);
      if (response.status === 410) setExpired(true);
      if (!response.ok) throw new Error(body.error?.message ?? "報到失敗");
      setSessions((items) => items.map((item) => item.id === session.id ? { ...item, status: "checked_in" } : item));
      setMessage(`${formatMemberDate(session.startAt)}，${session.coachName}教練的課程已完成報到，請安心上課。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "連線失敗，請重試；已成功的報到不會重複紀錄。");
    } finally {
      submitting.current = false;
      setBusyId(null);
    }
  }

  return <div className="stack">
    <p>報到會員：<strong>{displayName}</strong></p>
    {message && <div className="notice" role="status">{message}</div>}
    {expired && <div className="notice error" role="alert">QR Code 已過期，請重新掃描櫃台螢幕上的 QR Code。已完成的報到會保留。</div>}
    {error && !expired && <div className="notice error" role="alert">{error}</div>}
    {needsLogin && !expired && <a className="button" href={loginUrl}>使用 LINE 重新登入</a>}
    {loading ? <div className="card">正在查詢可報到課程…</div> : <>
      {!sessions.length && !error && !expired && <div className="card"><h2>目前沒有可報到的課程</h2><p className="muted">報到時間為上課前 30 分鐘至下課後 60 分鐘。請確認預約時間與登入帳號，或洽櫃台協助。</p></div>}
      {sessions.length > 1 && <p className="muted">以下課程皆在報到時段內，請選擇這次要上的課程。</p>}
      {sessions.map((session) => <article className="card stack" key={session.id}>
        <div><span className={`badge ${session.status === "checked_in" ? "status-checked_in" : ""}`}>{session.status === "checked_in" ? "已報到" : "可報到"}</span>
          <h2 className="qr-course-title">{formatMemberDate(session.startAt)}～{formatMemberTime(session.endAt)}</h2>
          <p>教練：{session.coachName}</p><p className="muted">方案：{session.planName}</p>
        </div>
        {session.status !== "checked_in" && <button className="button" disabled={expired || needsLogin || busyId !== null} onClick={() => checkIn(session)}>{busyId === session.id ? "正在報到…" : "確認報到"}</button>}
      </article>)}
      {!expired && !needsLogin && <button className="button secondary" disabled={busyId !== null} onClick={() => setRetry((value) => value + 1)}>重新查詢課程</button>}
    </>}
  </div>;
}
