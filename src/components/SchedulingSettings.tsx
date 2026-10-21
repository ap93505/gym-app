"use client";

import { useState } from "react";
import { isValidSlotCapacity, MAX_SLOT_CAPACITY } from "@/lib/domain/scheduling";

export function SchedulingSettings({ initialCapacity }: { initialCapacity: number }) {
  const [current, setCurrent] = useState(initialCapacity);
  const [draft, setDraft] = useState(String(initialCapacity));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const capacity = Number(draft);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/settings/scheduling", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotCapacity: capacity }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "儲存失敗");
      setCurrent(body.slotCapacity); setDraft(String(body.slotCapacity));
      setMessage(`已儲存：同時段最多 ${body.slotCapacity} 堂。重新整理行事曆即可更新容量提示。`);
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "連線失敗，請重新整理確認設定");
    } finally { setSaving(false); }
  }

  return <form className="card stack" onSubmit={save}>
    <h3>同時段課程上限</h3>
    <p>目前上限：<strong>{current} 堂</strong></p>
    <div className="field"><label htmlFor="slot-capacity">每個開始時段最多可登記的課程數</label><input id="slot-capacity" className="input" type="number" min="1" max={MAX_SLOT_CAPACITY} step="1" required value={draft} disabled={saving} onChange={(event) => setDraft(event.target.value)} /><span className="muted">可設定 1 至 {MAX_SLOT_CAPACITY} 堂；同一位教練或學生仍不能在同時段重複排課。</span></div>
    <p className="notice">儲存後套用至所有時段的新預約與移入課程。調低上限不會取消既有課程；已達上限的時段需先空出名額才能再安排。</p>
    {message && <div role="status" className={`notice ${failed ? "error" : ""}`}>{message}</div>}
    <div className="form-actions"><button className="button" disabled={saving || !isValidSlotCapacity(capacity) || capacity === current}>{saving ? "儲存中…" : "儲存設定"}</button></div>
  </form>;
}
