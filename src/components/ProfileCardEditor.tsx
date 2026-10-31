"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { DEFAULT_COACH_ID } from "@/lib/domain/cooperatingCoaches";

type Coach = { id: string; displayName: string; realName: string; nickname: string };

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
  const [draft, setDraft] = useState({ realName: profile.realName, nickname: profile.nickname, cooperatingCoachIds: profile.cooperatingCoachIds });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachesLoaded, setCoachesLoaded] = useState(false);
  const [coachError, setCoachError] = useState("");
  const isStudent = current.roles.includes("student");

  useEffect(() => {
    if (!isStudent) return;
    let active = true;
    void fetch("/api/coaches", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("載入教練失敗");
      const body = await response.json();
      if (active) { setCoaches(body.coaches); setCoachesLoaded(true); setCoachError(""); }
    }).catch(() => { if (active) { setCoachesLoaded(false); setCoachError("載入教練失敗，請關閉編輯視窗後重試，或重新整理頁面。"); } });
    return () => { active = false; };
  }, [isStudent, open]);

  function coachName(id: string) {
    const coach = coaches.find((item) => item.id === id);
    return coach ? coach.realName || coach.nickname || coach.displayName : `${id === DEFAULT_COACH_ID ? "Ray" : "原配合教練"}${coachesLoaded ? "（已停用或不具教練資格）" : ""}`;
  }
  const unavailable = draft.cooperatingCoachIds.filter((id) => !coaches.some((coach) => coach.id === id));
  const validCoaches = !isStudent || (coachesLoaded && draft.cooperatingCoachIds.length >= 1 && draft.cooperatingCoachIds.length <= 50 && unavailable.length === 0);

  function edit() {
    setDraft({ realName: current.realName, nickname: current.nickname, cooperatingCoachIds: [...current.cooperatingCoachIds] });
    setMessage("");
    setCoachError("");
    setCoachesLoaded(false);
    setOpen(true);
  }

  function close() { if (!saving) setOpen(false); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !validCoaches) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ realName: draft.realName, nickname: draft.nickname, ...(isStudent ? { cooperatingCoachIds: draft.cooperatingCoachIds } : {}) }),
      });
      const body = await response.json();
      if (response.ok) {
        setCurrent((value) => ({ ...value, ...body.profile }));
        setOpen(false);
      } else setMessage(body.error?.message ?? "更新失敗");
    } catch { setMessage("連線失敗，請重試儲存。"); }
    finally { setSaving(false); }
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
          {isStudent && <div className="field"><span className="muted">配合教練</span><div className="actions">{current.cooperatingCoachIds.map((id) => <span className="badge gray" key={id}>{coachName(id)}</span>)}</div>{coachError && !open && <p className="notice error">{coachError}</p>}</div>}
        </section>
      </div>
      <Modal open={open} title="編輯個人資料" onClose={close}>
        <form className="stack" onSubmit={save}>
          <div className="field"><label htmlFor="realName">本名</label><input id="realName" className="input" value={draft.realName} onChange={(event) => setDraft({ ...draft, realName: event.target.value })} maxLength={50} disabled={saving} required /></div>
          <div className="field"><label htmlFor="nickname">綽號</label><input id="nickname" className="input" value={draft.nickname} onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} maxLength={50} disabled={saving} required /></div>
          {isStudent && <div className="field" role="group" aria-labelledby="profile-coaches-label">
            <span id="profile-coaches-label">配合教練</span>
            <p className="muted">可選擇多位，至少保留一位。移除教練不會取消已安排的課程。</p>
            {coachesLoaded ? <div className="stack">{[...coaches.map((coach) => coach.id), ...unavailable].map((id) => <label key={id}>
              <input type="checkbox" checked={draft.cooperatingCoachIds.includes(id)} disabled={saving} onChange={(event) => setDraft({ ...draft, cooperatingCoachIds: event.target.checked ? [...draft.cooperatingCoachIds, id] : draft.cooperatingCoachIds.filter((item) => item !== id) })} /> {coachName(id)}
            </label>)}</div> : !coachError && <p className="muted">載入教練中…</p>}
            {coachesLoaded && !coaches.length && <p className="notice error">目前沒有有效教練，請聯絡管理員。</p>}
            {coachesLoaded && !draft.cooperatingCoachIds.length && <p className="notice error">請至少選擇一位配合教練。</p>}
            {coachError && <p className="notice error">{coachError}</p>}
          </div>}
          {message && <div className="notice error">{message}</div>}
          <div className="form-actions"><button className="button" disabled={saving || !validCoaches}>{saving ? "儲存中…" : "儲存"}</button><button type="button" className="button secondary" disabled={saving} onClick={close}>取消</button></div>
        </form>
      </Modal>
    </>
  );
}
