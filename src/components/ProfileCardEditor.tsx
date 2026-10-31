"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { CooperatingCoachesEditor } from "./CooperatingCoachesEditor";

type Profile = {
  id: string;
  roles: string[];
  cooperatingCoachIds: string[];
  realName: string;
  nickname: string;
  displayName: string;
  pictureUrl?: string;
  credits: { personalRemaining: number; sharedRemaining: number; totalRemaining: number; reserved: number; available: number; plans: Array<{ planId: string; planName: string; personalRemaining: number; sharedRemaining: number; totalRemaining: number; reserved: number; available: number }> };
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
        <section className="card span-4"><p className="muted">總剩餘堂數</p><div className="metric">{current.credits.totalRemaining}</div><p className="muted">個人 {current.credits.personalRemaining}／共用 {current.credits.sharedRemaining}（包含已預約）</p></section>
        <section className="card span-4"><p className="muted">已預約</p><div className="metric">{current.credits.reserved}</div><p className="muted">包含共用會員占用的堂數，完成後才扣堂</p></section>
        <section className="card span-4"><p className="muted">尚可預約</p><div className="metric">{current.credits.available}</div><p className="muted">目前仍可安排的課程</p></section>
        <section className="card span-12 stack"><h3>我的方案堂數</h3><p className="muted">共用餘額與其他會員共用，並非每人各有一份。其他會員使用後，重新整理即可看到最新餘額。</p>{current.credits.plans.length ? <div className="plan-credit-list">{current.credits.plans.map((plan) => <div className="plan-credit-row" key={plan.planId}><span className="badge">{plan.planName}</span><span className="badge gray">個人 {plan.personalRemaining}／共用 {plan.sharedRemaining}</span><span className="badge credit-total">剩餘 {plan.totalRemaining}</span><span className="badge credit-reserved">已預約 {plan.reserved}</span><span className="badge credit-available">可預約 {plan.available}</span></div>)}</div> : <p className="muted">目前沒有可使用的課堂方案。</p>}</section>
        <section className="card span-8 stack">
          <div className="page-heading" style={{ marginBottom: 0 }}>
            <div><h3>個人資料</h3><p className="muted">LINE 顯示名稱：{current.displayName}</p></div>
            <button className="button secondary small" onClick={edit}>編輯</button>
          </div>
          <div className="form-grid"><div><span className="muted">本名</span><p>{current.realName || "尚未填寫"}</p></div><div><span className="muted">綽號</span><p>{current.nickname || "尚未填寫"}</p></div></div>
        </section>
      </div>
      {current.roles.includes("student") && <section className="card stack"><h3>配合教練</h3><CooperatingCoachesEditor userId={current.id} coachIds={current.cooperatingCoachIds} onSaved={(ids) => setCurrent((value) => ({ ...value, cooperatingCoachIds: ids }))} /></section>}
      <Modal open={open} title="編輯個人資料" onClose={() => setOpen(false)}>
        <form className="stack" onSubmit={save}>
          <div className="field"><label htmlFor="realName">本名</label><input id="realName" className="input" value={draft.realName} onChange={(event) => setDraft({ ...draft, realName: event.target.value })} required /></div>
          <div className="field"><label htmlFor="nickname">綽號</label><input id="nickname" className="input" value={draft.nickname} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} required /></div>
          {message && <div className="notice error">{message}</div>}
          <div className="form-actions"><button className="button" disabled={saving}>{saving ? "儲存中…" : "儲存"}</button><button type="button" className="button secondary" onClick={() => setOpen(false)}>取消</button></div>
        </form>
      </Modal>
    </>
  );
}
