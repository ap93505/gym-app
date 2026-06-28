"use client";

import { useCallback, useEffect, useState } from "react";

type Member = { id: string; displayName: string; realName: string; nickname: string; roles: string[]; status: string; credits: { totalRemaining: number; reserved: number; available: number } };
const allRoles = ["admin", "coach", "student"];

export function MembersManager() {
  const [members, setMembers] = useState<Member[]>([]); const [amounts, setAmounts] = useState<Record<string, number>>({}); const [message, setMessage] = useState("");
  const load = useCallback(() => fetch("/api/users").then((r) => r.json()).then((b) => setMembers(b.users ?? [])), []);
  useEffect(() => { void load(); }, [load]);
  async function changeRole(member: Member, role: string, checked: boolean) {
    const roles = checked ? [...new Set([...member.roles, role])] : member.roles.filter((item) => item !== role);
    const response = await fetch(`/api/users/${member.id}/roles`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles }) });
    const body = await response.json(); setMessage(response.ok ? "權限已更新" : body.error?.message ?? "更新失敗"); if (response.ok) await load();
  }
  async function addCredits(member: Member) {
    const quantity = amounts[member.id] ?? 0;
    const response = await fetch(`/api/users/${member.id}/credits`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quantity, note: "後台人工加值" }) });
    const body = await response.json(); setMessage(response.ok ? `已為 ${member.realName || member.nickname || member.displayName} 增加 ${quantity} 堂` : body.error?.message ?? "加值失敗"); if (response.ok) { setAmounts({ ...amounts, [member.id]: 0 }); await load(); }
  }
  return <div className="stack">{message && <div className="notice">{message}</div>}<section className="card"><div className="table-wrap"><table><thead><tr><th>會員</th><th>角色</th><th>總剩餘／已預約／可預約</th><th>增加堂數</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.realName || member.nickname || member.displayName}</strong><div className="muted">{member.realName ? member.nickname : member.displayName}</div></td><td>{allRoles.map((role) => <label key={role} style={{ marginRight: 10, whiteSpace: "nowrap" }}><input type="checkbox" checked={member.roles.includes(role)} onChange={(e) => changeRole(member, role, e.target.checked)} /> {role}</label>)}</td><td>{member.credits.totalRemaining}／{member.credits.reserved}／{member.credits.available}</td><td><div className="actions"><input className="input" style={{ width: 90 }} type="number" min="1" value={amounts[member.id] ?? ""} onChange={(e) => setAmounts({ ...amounts, [member.id]: Number(e.target.value) })} /><button className="button small" disabled={!amounts[member.id]} onClick={() => addCredits(member)}>加值</button></div></td></tr>)}</tbody></table></div></section></div>;
}
