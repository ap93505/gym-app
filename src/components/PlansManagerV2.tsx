"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";

type Plan = { id: string; name: string; sessions: number; price: number; active: boolean };
type PlanDraft = { id?: string; name: string; sessions: number; price: number; active: boolean };
const emptyPlan: PlanDraft = { name: "", sessions: 10, price: 0, active: true };

export function PlansManagerV2() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(emptyPlan);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => fetch("/api/plans", { cache: "no-store" }).then((response) => response.json()).then((body) => setPlans(body.plans ?? [])), []);
  useEffect(() => { void load(); }, [load]);

  function create() { setDraft(emptyPlan); setMessage(""); setOpen(true); }
  function edit(plan: Plan) { setDraft(plan); setMessage(""); setOpen(true); }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch(draft.id ? `/api/plans/${draft.id}` : "/api/plans", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: draft.name, sessions: draft.sessions, price: draft.price, active: draft.active }),
    });
    const body = await response.json();
    if (response.ok) { setOpen(false); await load(); }
    else setMessage(body.error?.message ?? "儲存失敗");
    setSaving(false);
  }

  return <>
    <section className="card stack">
      <div className="page-heading" style={{ marginBottom: 0 }}><div><h3>方案列表</h3><p className="muted">方案內容只有在編輯 Modal 儲存後才會更新。</p></div><button className="button" onClick={create}>新增方案</button></div>
      <div className="table-wrap"><table><thead><tr><th>名稱</th><th>堂數</th><th>價格</th><th>狀態</th><th /></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}><td>{plan.name}</td><td>{plan.sessions}</td><td>NT$ {plan.price.toLocaleString()}</td><td><span className={`badge ${plan.active ? "" : "gray"}`}>{plan.active ? "上架" : "停用"}</span></td><td><button className="button secondary small" onClick={() => edit(plan)}>編輯</button></td></tr>)}</tbody></table></div>
    </section>
    <Modal open={open} title={draft.id ? "編輯課堂方案" : "新增課堂方案"} onClose={() => setOpen(false)}>
      <form className="stack" onSubmit={save}>
        <div className="field"><label>方案名稱</label><input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></div>
        <div className="form-grid"><div className="field"><label>堂數</label><input className="input" type="number" min="1" value={draft.sessions} onChange={(event) => setDraft({ ...draft, sessions: Number(event.target.value) })} required /></div><div className="field"><label>價格（NT$）</label><input className="input" type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} required /></div></div>
        <label><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> 方案上架</label>
        {message && <div className="notice error">{message}</div>}
        <div className="form-actions"><button className="button" disabled={saving}>{saving ? "儲存中…" : "儲存方案"}</button><button type="button" className="button secondary" onClick={() => setOpen(false)}>取消</button></div>
      </form>
    </Modal>
  </>;
}
