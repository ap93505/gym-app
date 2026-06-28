"use client";

import { useState } from "react";
import { Modal } from "./Modal";

type Profile = {
  realName: string;
  nickname: string;
  displayName: string;
  pictureUrl?: string;
  credits: { totalRemaining: number; reserved: number; available: number };
};

export function ProfileCardEditor({ profile }: { profile: Profile }) {
  const [current, setCurrent] = useState(profile);
  const [draft, setDraft] = useState({ realName: profile.realName, nickname: profile.nickname });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function edit() {
    setDraft({ realName: current.realName, nickname: current.nickname });
    setMessage("");
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await response.json();
    if (response.ok) {
      setCurrent({ ...current, ...draft });
      setOpen(false);
    } else setMessage(body.error?.message ?? "更新失敗");
    setSaving(false);
  }

  return (
    <>
      <div className="grid">
        <section className="card span-4"><p className="muted">總剩餘堂數</p><div className="metric">{current.credits.totalRemaining}</div><p className="muted">包含已預約但尚未完成的課程</p></section>
        <section className="card span-4"><p className="muted">已預約</p><div className="metric">{current.credits.reserved}</div><p className="muted">完成後才會正式扣堂</p></section>
        <section className="card span-4"><p className="muted">尚可預約</p><div className="metric">{current.credits.available}</div><p className="muted">目前仍可安排的課程</p></section>
        <section className="card span-8 stack">
          <div className="page-heading" style={{ marginBottom: 0 }}>
            <div><h3>個人資料</h3><p className="muted">LINE 顯示名稱：{current.displayName}</p></div>
            <button className="button secondary small" onClick={edit}>編輯</button>
          </div>
          <div className="form-grid"><div><span className="muted">本名</span><p>{current.realName || "尚未填寫"}</p></div><div><span className="muted">綽號</span><p>{current.nickname || "尚未填寫"}</p></div></div>
        </section>
      </div>
      <Modal open={open} title="編輯個人資料" onClose={() => setOpen(false)}>
        <form className="stack" onSubmit={save}>
          <div className="field"><label htmlFor="realName">本名</label><input id="realName" className="input" value={draft.realName} onChange={(event) => setDraft({ ...draft, realName: event.target.value })} required /></div>
          <div className="field"><label htmlFor="nickname">綽號</label><input id="nickname" className="input" value={draft.nickname} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} required /></div>
          {message && <div className="notice error">{message}</div>}
          <div className="actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>取消</button><button className="button" disabled={saving}>{saving ? "儲存中…" : "儲存"}</button></div>
        </form>
      </Modal>
    </>
  );
}
