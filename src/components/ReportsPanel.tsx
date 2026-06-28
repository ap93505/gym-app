"use client";

import { useEffect, useState } from "react";

type Row = { coachId: string; coachName: string; completed: number; notCompleted: number; noShow: number };
function dateInput(date: Date) { return date.toISOString().slice(0, 10); }

export function ReportsPanel() {
  const initialFrom = new Date(); initialFrom.setDate(1);
  const initialTo = new Date(initialFrom); initialTo.setMonth(initialTo.getMonth() + 1);
  const [from, setFrom] = useState(dateInput(initialFrom)); const [to, setTo] = useState(dateInput(initialTo)); const [rows, setRows] = useState<Row[]>([]);
  async function load() { const fromDate = new Date(`${from}T00:00:00+08:00`); const toDate = new Date(`${to}T00:00:00+08:00`); const body = await fetch(`/api/reports/coaches?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`).then((r) => r.json()); setRows(body.rows ?? []); }
  useEffect(() => {
    const fromDate = new Date(`${dateInput(initialFrom)}T00:00:00+08:00`);
    const toDate = new Date(`${dateInput(initialTo)}T00:00:00+08:00`);
    fetch(`/api/reports/coaches?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`)
      .then((response) => response.json()).then((body) => setRows(body.rows ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function exportCsv() {
    const lines = [["教練", "完成堂數", "未完成堂數", "學員爽約"], ...rows.map((row) => [row.coachName, row.completed, row.notCompleted, row.noShow])];
    const blob = new Blob(["\uFEFF" + lines.map((line) => line.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `coach-report-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  return <div className="stack"><section className="card"><div className="actions"><div className="field"><label>開始日</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div className="field"><label>結束日（不含）</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div><button className="button" onClick={load}>查詢</button><button className="button secondary" onClick={exportCsv}>匯出 CSV</button></div></section><section className="card"><div className="table-wrap"><table><thead><tr><th>教練</th><th>完成堂數</th><th>未完成</th><th>其中爽約</th></tr></thead><tbody>{rows.map((row) => <tr key={row.coachId}><td>{row.coachName}</td><td><strong>{row.completed}</strong></td><td>{row.notCompleted}</td><td>{row.noShow}</td></tr>)}</tbody></table></div></section></div>;
}
