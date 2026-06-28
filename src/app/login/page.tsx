import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <><SiteHeader /><main className="main" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="card stack">
        <div>
          <p className="eyebrow">Member access</p>
          <h1 style={{ fontFamily: "inherit", fontSize: 36 }}>會員登入</h1>
          <p className="muted">使用你的 LINE 帳號安全登入，不需要另外記住密碼。</p>
        </div>
        {params.error && <div className="notice error">LINE 登入未完成，請再試一次。</div>}
        <Link className="button" href="/api/auth/line/start">使用 LINE 登入</Link>
      </div>
    </main></>
  );
}
