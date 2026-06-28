"use client";

import { useCallback, useEffect, useState } from "react";

type Plan = { id: string; name: string; sessions: number; price: number; active: boolean };

export function PlansManager() {
  const [plans, setPlans] = useState<Plan[]>([]); const [name, setName] = useState(""); const [sessions, setSessions] = useState(10); const [price, setPrice] = useState(0); const [message, setMessage] = useState("");
  const load = useCallback(() => fetch("/api/plans").then((r) => r.json()).then((b) => setPlans(b.plans ?? [])), []);
  useEffect(() => { void load(); }, [load]);
  async function create(event: React.FormEvent) { event.preventDefault(); const response = await fetch("/api/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, sessions, price, active: true }) }); const body = await response.json(); setMessage(response.ok ? "方案已建立" : body.error?.message ?? "建立失敗"); if (response.ok) { setName(""); await load(); } }
  async function toggle(plan: Plan) { await fetch(`/api/plans/${plan.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...plan, active: !plan.active }) }); await load(); }
  return <div className="grid"><form className="card span-4 stack" onSubmit={create}><h3>新增方案</h3><div className="field"><label>方案名稱</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div><div className="field"><label>堂數</label><input className="input" type="number" min="1" value={sessions} onChange={(e) => setSessions(Number(e.target.value))} /></div><div className="field"><label>價格（NT$）</label><input className="input" type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>{message && <div className="notice">{message}</div>}<button className="button">建立方案</button></form><section className="card span-8"><h3>方案列表</h3><div className="table-wrap"><table><thead><tr><th>名稱</th><th>堂數</th><th>價格</th><th>狀態</th><th /></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}><td>{plan.name}</td><td>{plan.sessions}</td><td>NT$ {plan.price.toLocaleString()}</td><td><span className={`badge ${plan.active ? "" : "gray"}`}>{plan.active ? "上架" : "停用"}</span></td><td><button className="button secondary small" onClick={() => toggle(plan)}>{plan.active ? "停用" : "上架"}</button></td></tr>)}</tbody></table></div></section></div>;
}
