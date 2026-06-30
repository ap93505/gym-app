import { ReportsPanel } from "@/components/ReportsPanel";
import { requirePagePrincipal } from "@/lib/auth/session";

export default async function ReportsPage() { await requirePagePrincipal(["admin"]); return <main className="main"><div className="page-heading"><div><p className="eyebrow">Reports</p><h1>教練月報</h1><p className="muted">查看所選區間的完成、待確認與未完成堂數，並匯出逐堂明細。</p></div></div><ReportsPanel /></main>; }
