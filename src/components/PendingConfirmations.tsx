"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate, type SessionItem } from "./SessionList";

const reasons = [
  ["student_no_show", "學員爽約"], ["student_health", "學員身體不適"], ["coach_issue", "教練因素"],
  ["facility_issue", "場館／設備因素"], ["other", "其他"],
];

export function PendingConfirmations() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [forms, setForms] = useState<Record<string, { reason: string; note: string }>>({});
  const load = useCallback(async () => {
    const [pending, me] = await Promise.all([
      fetch("/api/sessions/pending-confirmation", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/me", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setSessions(pending.sessions ?? []); setIsAdmin(me.user?.roles.includes("admin") ?? false);
  }, []);
  useEffect(() => {
    Promise.all([
      fetch("/api/sessions/pending-confirmation", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/me", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([pending, me]) => {
      setSessions(pending.sessions ?? []); setIsAdmin(me.user?.roles.includes("admin") ?? false);
    });
  }, []);
  async function outcome(session: SessionItem, value: "completed" | "not_completed") {
    const form = forms[session.id] ?? { reason: "", note: "" };
    const response = await fetch(`/api/sessions/${session.id}/outcome`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: value, reason: form.reason || undefined, note: form.note || undefined }),
    });
    const body = await response.json(); setMessage(response.ok ? "課程結果已確認" : body.error?.message ?? "操作失敗");
    if (response.ok) await load();
  }
  async function backfill(session: SessionItem) {
    const response = await fetch(`/api/sessions/${session.id}/check-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId: session.studentId }) });
    const body = await response.json(); setMessage(response.ok ? "已補登報到，現在可以確認完成" : body.error?.message ?? "補登失敗");
    if (response.ok) await load();
  }
  return <div className="stack">
    {message && <div className="notice">{message}</div>}
    {!sessions.length && <div className="card"><h3>沒有待確認課程</h3><p className="muted">課程結束後會自動出現在此清單，但狀態不會被排程器修改。</p></div>}
    {sessions.map((session) => {
      const form = forms[session.id] ?? { reason: "", note: "" };
      return <article className="card stack" key={session.id}>
        <div className="page-heading" style={{ marginBottom: 0 }}><div><span className={`badge status-${session.status}`}>{session.status === "checked_in" ? "學生已報到" : "學生未報到"}</span><h3 style={{ marginTop: 10 }}>{session.coachName} × {session.studentName}</h3><p className="muted">{formatDate(session.startAt)}</p></div><div className="actions">{session.status !== "checked_in" && isAdmin && <button className="button secondary small" onClick={() => backfill(session)}>Admin 補登</button>}<button className="button small" disabled={session.status !== "checked_in"} onClick={() => outcome(session, "completed")}>確認完成</button></div></div>
        <details><summary className="muted" style={{ cursor: "pointer" }}>課程未完成</summary><div className="form-grid" style={{ marginTop: 14 }}><div className="field"><label>原因</label><select className="input" value={form.reason} onChange={(e) => setForms({ ...forms, [session.id]: { ...form, reason: e.target.value } })}><option value="">請選擇</option>{reasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><div className="field"><label>說明</label><textarea className="input" value={form.note} onChange={(e) => setForms({ ...forms, [session.id]: { ...form, note: e.target.value } })} /></div></div><button className="button danger small" disabled={!form.reason || !form.note.trim()} onClick={() => outcome(session, "not_completed")}>確認未完成</button></details>
      </article>;
    })}
  </div>;
}
