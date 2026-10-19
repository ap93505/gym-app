import { PlansManager } from "@/components/PlansManager";
import { requirePagePrincipal } from "@/lib/auth/session";

export default async function PlansPage() { await requirePagePrincipal(["admin"]); return <main className="main"><div className="page-heading"><div><p className="eyebrow">Products</p><h1>方案管理</h1><p className="muted">維護目前可購買的堂數與價格。</p></div></div><PlansManager /></main>; }
