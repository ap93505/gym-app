import { ReportsPanel } from "@/components/ReportsPanel";
import { requirePagePrincipal } from "@/lib/auth/session";

export default async function ReportsPage() { await requirePagePrincipal(["admin"]); return <main className="main"><div className="page-heading"><div><p className="eyebrow">Reports</p><h1>教練月報</h1><p className="muted">只將教練確認完成的課程計入上課堂數。</p></div></div><ReportsPanel /></main>; }
