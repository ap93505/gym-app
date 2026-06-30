"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";

type Member = {
  id: string;
  displayName: string;
  realName: string;
  nickname: string;
  roles: string[];
  status: string;
  credits: { totalRemaining: number; reserved: number; available: number };
};

type Plan = { id: string; name: string; sessions: number; price: number; active: boolean };

const allRoles = ["admin", "coach", "student"];

export function MembersManagerV2() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [mode, setMode] = useState<"roles" | "credits">("roles");
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [planId, setPlanId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const [memberResponse, planResponse] = await Promise.all([
      fetch("/api/users", { cache: "no-store" }),
      fetch("/api/plans?active=true", { cache: "no-store" }),
    ]);
    const [memberBody, planBody] = await Promise.all([memberResponse.json(), planResponse.json()]);
    setMembers(memberBody.users ?? []);
    setPlans(planBody.plans ?? []);
  }, []);
  useEffect(() => {
    void Promise.all([
      fetch("/api/users", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/plans?active=true", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([memberBody, planBody]) => {
      setMembers(memberBody.users ?? []);
      setPlans(planBody.plans ?? []);
    });
  }, []);

  function editRoles(member: Member) { setSelected(member); setMode("roles"); setDraftRoles(member.roles); setMessage(""); }
  function addCredits(member: Member) { setSelected(member); setMode("credits"); setPlanId(""); setMessage(""); }
  function toggleRole(role: string, checked: boolean) {
    setDraftRoles(checked ? [...new Set([...draftRoles, role])] : draftRoles.filter((item) => item !== role));
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setMessage("");
    const response = mode === "roles"
      ? await fetch(`/api/users/${selected.id}/roles`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: draftRoles }) })
      : await fetch(`/api/users/${selected.id}/credits`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId }) });
    const body = await response.json();
    if (response.ok) { setSelected(null); await load(); }
    else setMessage(body.error?.message ?? "更新失敗");
    setSaving(false);
  }

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-TW");
    if (!keyword) return members;
    return members.filter((member) => [member.displayName, member.realName, member.nickname]
      .some((value) => value?.toLocaleLowerCase("zh-TW").includes(keyword)));
  }, [members, search]);

  return <>
    <section className="card stack">
      <form className="member-search" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft); }}>
        <div className="field"><label htmlFor="member-search">搜尋 LINE 顯示名稱、本名或綽號</label><input id="member-search" className="input" type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="輸入會員名稱" /></div>
        <div className="form-actions"><button className="button" type="submit">搜尋</button><button className="button secondary" type="button" onClick={() => { setSearchDraft(""); setSearch(""); }}>清除</button></div>
      </form>
      <p className="muted search-result-count">顯示 {filteredMembers.length} / {members.length} 位會員</p>
      <div className="table-wrap"><table className="member-table"><thead><tr><th>會員</th><th>角色</th><th>堂數</th><th>操作</th></tr></thead><tbody>{filteredMembers.map((member) => <tr key={member.id}><td data-label="會員"><strong>{member.realName || member.nickname || member.displayName}</strong><div></div><div className="muted">LINE：{member.displayName || "－"}<br />本名：{member.realName || "－"}<br />綽號：{member.nickname || "－"}</div></td><td data-label="角色"><div className="actions">{member.roles.map((role) => <span className="badge" key={role}>{role}</span>)}</div></td><td data-label="堂數"><div className="credit-badges"><span className="badge credit-total">總剩餘 {member.credits.totalRemaining}</span><span className="badge credit-reserved">已預約 {member.credits.reserved}</span><span className="badge credit-available">可預約 {member.credits.available}</span></div></td><td data-label="操作"><div className="actions"><button className="button secondary small" onClick={() => editRoles(member)}>編輯權限</button><button className="button small" onClick={() => addCredits(member)}>儲值堂數</button></div></td></tr>)}</tbody></table></div>
      {!filteredMembers.length && <div className="notice">找不到符合條件的會員。</div>}
    </section>
    <Modal open={!!selected} title={mode === "roles" ? "編輯會員權限" : "選擇儲值方案"} onClose={() => setSelected(null)}>
      {selected && <div className="stack">
        <div><strong>{selected.realName || selected.nickname || selected.displayName}</strong><p className="muted">所有變更會在按下確認後才寫入。</p></div>
        {mode === "roles" ? <div className="stack">{allRoles.map((role) => <label key={role}><input type="checkbox" checked={draftRoles.includes(role)} onChange={(event) => toggleRole(role, event.target.checked)} /> {role}</label>)}</div> : <div className="field"><label>課堂方案</label><select className="input" value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">請選擇方案</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}｜{plan.sessions} 堂｜NT$ {plan.price.toLocaleString()}</option>)}</select>{planId && <div className="notice">將新增 <strong>{plans.find((plan) => plan.id === planId)?.sessions} 堂</strong>，有效期限為加值日起 10 年。</div>}{!plans.length && <div className="notice error">目前沒有已上架方案，請先至方案管理建立方案。</div>}</div>}
        {message && <div className="notice error">{message}</div>}
        <div className="form-actions"><button className="button" disabled={saving || (mode === "roles" ? draftRoles.length === 0 : !planId)} onClick={save}>{saving ? "處理中…" : "確認"}</button><button className="button secondary" onClick={() => setSelected(null)}>取消</button></div>
      </div>}
    </Modal>
  </>;
}
