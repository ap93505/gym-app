import Link from "next/link";
import { requirePagePrincipal } from "@/lib/auth/session";
import { listSessions, pendingConfirmations } from "@/lib/services/sessions";
import { DashboardMonthCalendar } from "@/components/DashboardMonthCalendar";

function taipeiDayRange() {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export default async function DashboardPage() {
  const principal = await requirePagePrincipal(["admin", "coach"]);
  const { start, end } = taipeiDayRange();
  const [pending, today] = await Promise.all([
    pendingConfirmations(principal).catch(() => []),
    listSessions(start, end, principal).catch(() => []),
  ]);
  const activeToday = today.filter((session) => session.status !== "cancelled");
  const myToday = activeToday.filter((session) => session.coachId === principal.userId);
  return <main className="main"><div className="page-heading"><div><p className="eyebrow">Staff console</p><h1>管理後台</h1><p className="muted">你好，{principal.displayName}。</p></div><Link className="button" href="/dashboard/calendar">新增課程</Link></div><div className="grid dashboard-metrics"><Link href="/dashboard/calendar" className="card span-3"><p className="muted">今天總課程數</p><div className="metric">{activeToday.length}</div><p className="muted">全館今天的預約</p></Link><Link href="/dashboard/calendar" className="card span-3"><p className="muted">我負責的課程數</p><div className="metric">{myToday.length}</div><p className="muted">今天由我授課</p></Link><Link href="/dashboard/pending" className="card span-3"><p className="muted">待確認的課程</p><div className="metric">{pending.length}</div><p className="muted">課後尚未確認結果</p></Link><div className="card span-3"><p className="muted">我的權限</p><div className="role-badges">{principal.roles.map((role) => <span className="badge" key={role}>{role}</span>)}</div><p className="muted">依權限顯示可操作功能</p></div></div><DashboardMonthCalendar /></main>;
}
