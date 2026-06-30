"use client";

import { useEffect, useMemo, useState } from "react";
import { sessionStatusLabels } from "@/lib/domain/sessionPresentation";

type Row = { coachId: string; coachName: string; completed: number; pending: number; notCompleted: number };
type Detail = { id: string; coachId: string; coachName: string; studentName: string; startAt: string; endAt: string; status: string };

function dateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function csvCell(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }
function detailTimeRange(startAt: string, endAt: string) {
  const date = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit", weekday: "short" }).format(new Date(startAt));
  const time = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time.format(new Date(startAt))}–${time.format(new Date(endAt))}`;
}
function reportDetailStatus(detail: Detail) {
  if (["scheduled", "checked_in"].includes(detail.status) && new Date(detail.endAt).getTime() <= Date.now()) return "待確認";
  return sessionStatusLabels[detail.status] ?? detail.status;
}

export function ReportsPanel() {
  const initialFrom = new Date(); initialFrom.setDate(1);
  const initialTo = new Date(initialFrom); initialTo.setMonth(initialTo.getMonth() + 1);
  const [from, setFrom] = useState(dateInput(initialFrom));
  const [to, setTo] = useState(dateInput(initialTo));
  const [rows, setRows] = useState<Row[]>([]);
  const [details, setDetails] = useState<Detail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function requestReport(fromValue: string, toValue: string) {
    setLoading(true); setError("");
    const fromDate = new Date(`${fromValue}T00:00:00+08:00`);
    const toDate = new Date(`${toValue}T00:00:00+08:00`);
    try {
      const response = await fetch(`/api/reports/coaches?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "報表載入失敗");
      setRows(body.rows ?? []); setDetails(body.details ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "報表載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const fromDate = new Date(); fromDate.setDate(1);
    const toDate = new Date(fromDate); toDate.setMonth(toDate.getMonth() + 1);
    fetch(`/api/reports/coaches?from=${new Date(`${dateInput(fromDate)}T00:00:00+08:00`).toISOString()}&to=${new Date(`${dateInput(toDate)}T00:00:00+08:00`).toISOString()}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "報表載入失敗");
        return body;
      })
      .then((body) => { setRows(body.rows ?? []); setDetails(body.details ?? []); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "報表載入失敗"))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => rows.reduce((sum, row) => ({
    completed: sum.completed + row.completed,
    pending: sum.pending + row.pending,
    notCompleted: sum.notCompleted + row.notCompleted,
  }), { completed: 0, pending: 0, notCompleted: 0 }), [rows]);
  const maxCount = Math.max(1, ...rows.map((row) => row.completed + row.pending + row.notCompleted));

  function exportCsv() {
    const summary: Array<Array<string | number>> = [
      ["教練", "完成堂數", "待確認", "未完成"],
      ...rows.map((row) => [row.coachName, row.completed, row.pending, row.notCompleted]),
      ["所有教練加總", total.completed, total.pending, total.notCompleted],
      [],
      ["教練", "日期與時段", "學生", "狀態"],
      ...details.map((detail) => [detail.coachName, detailTimeRange(detail.startAt, detail.endAt), detail.studentName, reportDetailStatus(detail)]),
    ];
    const blob = new Blob(["\uFEFF" + summary.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `coach-report-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <div className="stack">
    <section className="card"><form className="report-filters" onSubmit={(event) => { event.preventDefault(); void requestReport(from, to); }}><div className="field"><label>開始日</label><input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></div><div className="field"><label>結束日（不含）</label><input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></div><div className="form-actions"><button className="button" disabled={loading}>{loading ? "查詢中…" : "查詢"}</button><button type="button" className="button secondary" onClick={exportCsv} disabled={!rows.length}>匯出 CSV</button></div></form></section>
    {error && <div className="notice error">{error}</div>}
    <section className="card stack"><div><h3>區間堂數分布</h3><div className="calendar-status-legend"><span className="badge status-completed">完成</span><span className="badge status-checked_in">待確認</span><span className="badge status-not_completed">未完成</span></div></div><div className="stacked-chart" role="img" aria-label="各教練完成、待確認及未完成堂數堆疊柱狀圖">{rows.map((row) => { const count = row.completed + row.pending + row.notCompleted; return <div className="chart-column" key={row.coachId}><div className="chart-value">{count}</div><div className="chart-track"><div className="chart-stack" style={{ height: `${count / maxCount * 100}%` }} title={`${row.coachName}：完成 ${row.completed}、待確認 ${row.pending}、未完成 ${row.notCompleted}`}><span className="chart-segment completed" style={{ flexGrow: row.completed }} /><span className="chart-segment pending" style={{ flexGrow: row.pending }} /><span className="chart-segment not-completed" style={{ flexGrow: row.notCompleted }} /></div></div><div className="chart-label">{row.coachName}</div></div>; })}</div></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>教練</th><th>完成堂數</th><th>待確認</th><th>未完成</th></tr></thead><tbody>{rows.map((row) => <tr key={row.coachId}><td>{row.coachName}</td><td><strong>{row.completed}</strong></td><td>{row.pending}</td><td>{row.notCompleted}</td></tr>)}<tr className="report-total"><td>所有教練加總</td><td><strong>{total.completed}</strong></td><td><strong>{total.pending}</strong></td><td><strong>{total.notCompleted}</strong></td></tr></tbody></table></div></section>
  </div>;
}
