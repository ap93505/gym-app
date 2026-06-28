"use client";

import { useEffect, useMemo, useState } from "react";

type UserOption = { id: string; realName: string; nickname: string; displayName: string; roles: string[]; credits: { available: number } };
type Me = UserOption;

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function nextDefault() {
  const date = new Date(); date.setDate(date.getDate() + 1); date.setMinutes(0, 0, 0);
  return localDateTime(date);
}

function addOccurrence(start: Date, frequency: string, index: number) {
  const result = new Date(start);
  if (frequency === "daily") result.setDate(result.getDate() + index);
  if (frequency === "weekly") result.setDate(result.getDate() + index * 7);
  if (frequency === "monthly") {
    const originalDay = result.getDate(); result.setDate(1); result.setMonth(result.getMonth() + index);
    const last = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate(); result.setDate(Math.min(originalDay, last));
  }
  return result;
}

export function SessionForm({ onCreated }: { onCreated: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [students, setStudents] = useState<UserOption[]>([]);
  const [coaches, setCoaches] = useState<UserOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [startLocal, setStartLocal] = useState(nextDefault());
  const [frequency, setFrequency] = useState("none");
  const [mode, setMode] = useState<"count" | "end">("count");
  const [count, setCount] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/users?role=student").then((r) => r.json()),
      fetch("/api/users?role=coach").then((r) => r.json()),
    ]).then(([meBody, studentBody, coachBody]) => {
      setMe(meBody.user); setStudents(studentBody.users ?? []); setCoaches(coachBody.users ?? []);
      if (meBody.user?.roles.includes("coach") && !meBody.user?.roles.includes("admin")) setCoachId(meBody.user.id);
    });
  }, []);

  const selectedStudent = students.find((user) => user.id === studentId);
  const maxCount = Math.min(selectedStudent?.credits.available ?? 0, 100);
  const calculatedEnd = useMemo(() => {
    if (!startLocal || frequency === "none") return startLocal ? new Date(startLocal) : null;
    return addOccurrence(new Date(startLocal), frequency, Math.max(0, count - 1));
  }, [startLocal, frequency, count]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true); setMessage("");
    const start = new Date(startLocal);
    let recurrence: Record<string, unknown> = { frequency };
    if (frequency !== "none") {
      if (mode === "count") recurrence = { frequency, count };
      else {
        const end = new Date(`${endDate}T${startLocal.slice(11, 16)}`);
        recurrence = { frequency, endAt: end.toISOString() };
      }
    }
    const response = await fetch("/api/sessions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, coachId, startAt: start.toISOString(), recurrence }),
    });
    const body = await response.json();
    setMessage(response.ok ? `已建立 ${body.count} 堂課` : `${body.error?.message ?? "建立失敗"}${body.error?.details ? `：${body.error.details.join("、")}` : ""}`);
    if (response.ok) onCreated();
    setSubmitting(false);
  }

  const isAdmin = me?.roles.includes("admin");
  return <form className="card stack" onSubmit={submit}>
    <div><h3>建立課程</h3><p className="muted">每堂固定一小時，系統會檢查三組容量及教練／學生撞堂。</p></div>
    <div className="form-grid">
      <div className="field"><label>學生</label><select className="input" value={studentId} onChange={(e) => { setStudentId(e.target.value); setCount(1); }} required><option value="">請選擇</option>{students.map((user) => <option value={user.id} key={user.id}>{user.realName || user.nickname || user.displayName}（可預約 {user.credits.available}）</option>)}</select></div>
      <div className="field"><label>教練</label><select className="input" value={coachId} onChange={(e) => setCoachId(e.target.value)} disabled={!isAdmin} required><option value="">請選擇</option>{coaches.map((user) => <option value={user.id} key={user.id}>{user.realName || user.nickname || user.displayName}</option>)}</select></div>
      <div className="field"><label>第一堂時間</label><input className="input" type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} required /></div>
      <div className="field"><label>循環</label><select className="input" value={frequency} onChange={(e) => { setFrequency(e.target.value); setCount(1); }}><option value="none">不重複</option><option value="daily">每日</option><option value="weekly">每週</option><option value="monthly">每月</option></select></div>
    </div>
    {frequency !== "none" && <div className="stack">
      <div className="actions"><button type="button" className={`button small ${mode === "count" ? "" : "secondary"}`} onClick={() => setMode("count")}>依循環次數</button><button type="button" className={`button small ${mode === "end" ? "" : "secondary"}`} onClick={() => setMode("end")}>依結束日</button></div>
      {mode === "count" ? <div className="field"><label>循環次數（學生目前最多 {maxCount} 次）</label><input className="input" type="number" min="1" max={maxCount || 1} value={count} onChange={(e) => setCount(Number(e.target.value))} required /></div> : <div className="field"><label>結束日</label><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>}
      {mode === "count" && calculatedEnd && <div className="notice">共 {count} 堂，最後一堂為 {calculatedEnd.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}；建立後尚可預約 {Math.max(0, maxCount - count)} 堂。</div>}
    </div>}
    {message && <div className={message.includes("失敗") || message.includes("不足") || message.includes("衝突") ? "notice error" : "notice"}>{message}</div>}
    <div><button className="button" disabled={submitting || !studentId || !coachId || (frequency !== "none" && mode === "count" && count > maxCount)}>{submitting ? "建立中…" : "建立課程"}</button></div>
  </form>;
}
