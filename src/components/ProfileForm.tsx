"use client";

import { useState } from "react";

type Profile = {
  realName: string;
  nickname: string;
  displayName: string;
  pictureUrl?: string;
  credits: { totalRemaining: number; reserved: number; available: number };
};

export function ProfileForm({ profile }: { profile: Profile }) {
  const [realName, setRealName] = useState(profile.realName);
  const [nickname, setNickname] = useState(profile.nickname);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ realName, nickname }),
    });
    const body = await response.json();
    setMessage(response.ok ? "資料已更新" : body.error?.message ?? "更新失敗");
    setSaving(false);
  }
  return (
    <div className="grid">
      <section className="card span-4">
        <p className="muted">總剩餘堂數</p><div className="metric">{profile.credits.totalRemaining}</div>
        <p className="muted">包含已預約但尚未完成的課程</p>
      </section>
      <section className="card span-4">
        <p className="muted">已預約</p><div className="metric">{profile.credits.reserved}</div>
        <p className="muted">完成後才會正式扣堂</p>
      </section>
      <section className="card span-4">
        <p className="muted">尚可預約</p><div className="metric">{profile.credits.available}</div>
        <p className="muted">目前仍可安排的課程</p>
      </section>
      <form className="card span-8 stack" onSubmit={save}>
        <div><h3>個人資料</h3><p className="muted">LINE 顯示名稱：{profile.displayName}</p></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="realName">本名</label><input id="realName" className="input" value={realName} onChange={(e) => setRealName(e.target.value)} required /></div>
          <div className="field"><label htmlFor="nickname">綽號</label><input id="nickname" className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} required /></div>
        </div>
        {message && <div className={message.includes("失敗") ? "notice error" : "notice"}>{message}</div>}
        <div className="form-actions"><button className="button" disabled={saving}>{saving ? "儲存中…" : "儲存資料"}</button></div>
      </form>
    </div>
  );
}
