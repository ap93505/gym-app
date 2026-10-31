"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { DEFAULT_COACH_ID } from "@/lib/domain/cooperatingCoaches";

type Coach = { id: string; displayName: string; realName: string; nickname: string };

export function CooperatingCoachesEditor({ userId, coachIds, onSaved, initialOpen = false, onClose }: {
  userId: string; coachIds: string[]; onSaved: (ids: string[]) => void; initialOpen?: boolean; onClose?: () => void;
}) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [open, setOpen] = useState(initialOpen);
  const [draft, setDraft] = useState<string[]>(coachIds);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/coaches", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("載入教練失敗");
      const body = await response.json();
      if (active) { setCoaches(body.coaches); setLoaded(true); setMessage(""); }
    }).catch(() => { if (active) setMessage("載入教練失敗，請重新整理後再試。"); });
    return () => { active = false; };
  }, [open]);
  function name(id: string) {
    const coach = coaches.find((item) => item.id === id);
    return coach ? coach.realName || coach.nickname || coach.displayName : `${id === DEFAULT_COACH_ID ? "Ray" : "原配合教練"}${loaded ? "（已停用或不具教練資格）" : ""}`;
  }
  function close() { if (!saving) { setOpen(false); onClose?.(); } }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/users/${userId}/coaches`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cooperatingCoachIds: draft }),
      });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error?.message ?? "儲存失敗"); return; }
      onSaved(body.cooperatingCoachIds); setOpen(false);
    } catch { setMessage("連線失敗，請重試。"); }
    finally { setSaving(false); }
  }
  const unavailable = draft.filter((id) => !coaches.some((coach) => coach.id === id));
  return <>
    {!initialOpen && <div className="stack">
      <div className="actions">{coachIds.map((id) => <span className="badge gray" key={id}>{name(id)}</span>)}</div>
      <button className="button secondary small" type="button" onClick={() => { setDraft([...coachIds]); setOpen(true); }}>編輯配合教練</button>
      {message && !open && <p className="notice error">{message}</p>}
    </div>}
    <Modal open={open} title="配合教練" onClose={close}>
      <form className="stack" onSubmit={save}>
        <p className="muted">可選擇多位，至少保留一位配合教練。移除教練不會取消已安排的課程。</p>
        {loaded ? [...coaches.map((coach) => coach.id), ...unavailable].map((id) => <label key={id}>
          <input type="checkbox" checked={draft.includes(id)} disabled={saving} onChange={(event) => setDraft(event.target.checked ? [...draft, id] : draft.filter((item) => item !== id))} /> {name(id)}
        </label>) : <p className="muted">載入教練中…</p>}
        {loaded && !coaches.length && <div className="notice error">目前沒有可選擇的有效教練，請聯絡管理員設定教練權限。</div>}
        {message && <div className="notice error">{message}</div>}
        <div className="form-actions"><button className="button" disabled={saving || !loaded || !draft.length || draft.length > 50 || unavailable.length > 0}>{saving ? "儲存中…" : "儲存"}</button><button className="button secondary" type="button" disabled={saving} onClick={close}>取消</button></div>
      </form>
    </Modal>
  </>;
}
