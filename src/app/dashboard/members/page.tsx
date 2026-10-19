import { MembersManager } from "@/components/MembersManager";
import { requirePagePrincipal } from "@/lib/auth/session";

export default async function MembersPage() { await requirePagePrincipal(["admin"]); return <main className="main"><div className="page-heading"><div><p className="eyebrow">Members</p><h1>會員管理</h1><p className="muted">管理角色、基本堂數與預約占用狀態。</p></div></div><MembersManager /></main>; }
