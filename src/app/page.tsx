import Link from "next/link";
import { getPrincipal } from "@/lib/auth/session";
import { SiteHeader } from "@/components/SiteHeader";

export default async function Home() {
  const principal = await getPrincipal();
  return (
    <><SiteHeader /><main className="hero">
      <section>
        <p className="eyebrow">Move gently, grow steadily.</p>
        <h1>讓每一次訓練，清楚而從容。</h1>
        <p className="lead">查看剩餘堂數、下一堂預約與完成報到；把時間留給真正重要的訓練。</p>
        <div className="actions">
          <Link className="button" href={principal ? "/member/account" : "/api/auth/line/start"}>
            {principal ? "進入會員中心" : "使用 LINE 登入"}
          </Link>
          {principal?.roles.some((role) => role === "admin" || role === "coach") && (
            <Link className="button secondary" href="/dashboard">進入管理後台</Link>
          )}
        </div>
      </section>
      <aside className="hero-card">
        <p className="eyebrow">Today</p>
        <h2>從預約到結課，一目了然。</h2>
        <div className="stack">
          <div><span className="badge">會員</span><p className="muted">LINE 登入、堂數查詢、預約與報到</p></div>
          <div><span className="badge">教練</span><p className="muted">全館行事曆、自己的課程與人工結課</p></div>
          <div><span className="badge">管理</span><p className="muted">會員、堂數、方案、補登與報表</p></div>
        </div>
      </aside>
    </main></>
  );
}
