"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionForm } from "./SessionForm";
import { type SessionItem } from "./SessionList";
import { StaffSessionRows } from "./StaffSessionRows";

export function StaffCalendar() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); const from = new Date(); from.setDate(from.getDate() - 14); const to = new Date(); to.setMonth(to.getMonth() + 3);
    const body = await fetch(`/api/sessions?from=${from.toISOString()}&to=${to.toISOString()}`, { cache: "no-store" }).then((r) => r.json());
    setSessions(body.sessions ?? []); setLoading(false);
  }, []);
  useEffect(() => {
    const from = new Date(); from.setDate(from.getDate() - 14); const to = new Date(); to.setMonth(to.getMonth() + 3);
    fetch(`/api/sessions?from=${from.toISOString()}&to=${to.toISOString()}`, { cache: "no-store" })
      .then((response) => response.json()).then((body) => setSessions(body.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);
  return <div className="grid"><div className="card span-12" style={{ padding: 0, border: 0, background: "transparent", boxShadow: "none" }}><SessionForm onCreated={load} /></div><section className="card span-12"><div className="page-heading"><div><h3>近期全館課程</h3><p className="muted">顏色代表不同教練；已完成、未完成及取消的課程會淡化顯示。</p></div></div>{loading ? <p>載入中…</p> : sessions.length ? <StaffSessionRows sessions={sessions} reload={load} /> : <p className="muted">尚無課程。</p>}</section></div>;
}
