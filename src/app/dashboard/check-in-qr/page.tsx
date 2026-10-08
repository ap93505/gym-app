import { AdminCheckInQr } from "@/components/AdminCheckInQr";
import { requirePagePrincipal } from "@/lib/auth/session";

export default async function CheckInQrPage() {
  await requirePagePrincipal(["admin"]);
  return <main className="main">
    <div className="page-heading"><div><p className="eyebrow">Front desk</p><h1>報到 QR Code</h1><p className="muted">將此頁面放在櫃台，讓會員使用手機相機掃描。</p></div></div>
    <AdminCheckInQr />
  </main>;
}
