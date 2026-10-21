"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";

type MemberOption = { id: string; displayName: string; realName: string; nickname: string; roles: string[]; status: string };
type Batch = {
  id: string; ownerId: string; planName: string; originalUnits: number;
  remainingUnits: number; reservedUnits: number; grantedAt: string | null; expiresAt: string | null;
  status: string; expired: boolean; voidReason: string; members: Array<{ id: string; name: string }>;
  canVoid: boolean; blockedReason: string | null;
};

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "－";

export function CreditBatchManager({ member, members, onClose, onChanged }: {
  member: MemberOption; members: MemberOption[]; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<{ batch: Batch; type: "share" | "void" } | null>(null);
  const [memberId, setMemberId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/users/${member.id}/credits`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "讀取失敗");
        if (active) setBatches(body.batches);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "讀取失敗"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [member.id]);

  async function submit() {
    if (!action) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/users/${action.batch.ownerId}/credits/${action.batch.id}`, {
        method: action.type === "share" ? "PATCH" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action.type === "share" ? { memberId } : { reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "更新失敗");
      setAction(null);
      const refresh = await fetch(`/api/users/${member.id}/credits`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (!refresh.ok) throw new Error(refreshed.error?.message ?? "重新讀取失敗，請關閉後重開");
      setBatches(refreshed.batches);
      await onChanged();
      setMessage("已更新儲值紀錄。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗，請稍後重試");
    } finally { setSaving(false); }
  }

  return <Modal open title={`${member.realName || member.nickname || member.displayName} 的儲值紀錄`} onClose={() => { if (!saving) onClose(); }} wide>
    <div className="stack">
      <p className="muted">共用會員使用同一筆餘額。曾預約、報到或使用過的儲值不能作廢；作廢會保留紀錄。</p>
      {loading && <p role="status">讀取中…</p>}
      {!loading && !batches.length && <p>目前沒有儲值紀錄。</p>}
      {batches.map((batch) => <section className="card stack" key={`${batch.ownerId}/${batch.id}`}>
        <div><strong>{batch.planName}</strong> <span className="badge">{batch.status === "voided" ? "已作廢" : batch.expired ? "已到期" : batch.members.length > 1 ? "共用" : "個人"}</span></div>
        <div className="muted">儲值時間：{dateLabel(batch.grantedAt)}<br />到期時間：{dateLabel(batch.expiresAt)}</div>
        <div className="credit-badges"><span className="badge">原始 {batch.originalUnits} 堂</span><span className="badge credit-total">剩餘 {batch.remainingUnits}</span><span className="badge credit-reserved">已預約 {batch.reservedUnits}</span><span className="badge credit-available">可預約 {batch.status === "voided" || batch.expired ? 0 : Math.max(0, batch.remainingUnits - batch.reservedUnits)}</span></div>
        <p>使用會員：{batch.members.map((item) => item.name).join("、")}</p>
        {batch.status === "voided" ? <p className="muted">作廢原因：{batch.voidReason}</p> : <>
          <div className="actions">
            <button className="button secondary small" disabled={saving || batch.members.length >= 20 || batch.expired} onClick={() => { setAction({ batch, type: "share" }); setMemberId(""); setMessage(""); }}>加入共用會員</button>
            <button className="button secondary small" disabled={saving || !batch.canVoid} onClick={() => { setAction({ batch, type: "void" }); setReason(""); setMessage(""); }}>刪除／作廢儲值</button>
          </div>
          {batch.blockedReason && <p className="muted">{batch.blockedReason}</p>}
        </>}
        {action?.batch.id === batch.id && action.batch.ownerId === batch.ownerId && <div className="stack">
          {action.type === "share" ? <>
            <div className="field"><label htmlFor="shared-member">加入共用的會員</label><select id="shared-member" className="input" value={memberId} onChange={(event) => setMemberId(event.target.value)} disabled={saving}>
              <option value="">請選擇會員</option>
              {members.filter((item) => item.roles.includes("student") && item.status !== "disabled" && !batch.members.some((existing) => existing.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.realName || item.nickname || item.displayName}</option>)}
            </select></div>
            <p className="notice">加入後可使用這筆儲值的剩餘堂數，不會新增堂數。目前提供新增共用會員，尚不支援移除。</p>
          </> : <>
            <p className="notice">確認作廢「{batch.planName}」{batch.remainingUnits} 堂？{batch.members.length > 1 ? "所有共用會員都將無法再使用這筆堂數。" : "作廢後無法再使用這筆堂數。"}</p>
            <div className="field"><label htmlFor="void-reason">作廢原因</label><input id="void-reason" className="input" value={reason} maxLength={500} disabled={saving} onChange={(event) => setReason(event.target.value)} /></div>
          </>}
          <div className="form-actions"><button className="button" disabled={saving || (action.type === "share" ? !memberId : !reason.trim())} onClick={submit}>{saving ? "處理中…" : action.type === "share" ? "確認加入" : "確認作廢"}</button><button className="button secondary" disabled={saving} onClick={() => setAction(null)}>取消</button></div>
        </div>}
      </section>)}
      {message && <div className="notice" role="status">{message}</div>}
    </div>
  </Modal>;
}
