import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { QrCheckInPanel } from "@/components/QrCheckInPanel";
import { verifyCheckInQrToken } from "@/lib/auth/checkInQr";
import { getPrincipal, requireApiPrincipal } from "@/lib/auth/session";
import { AppError } from "@/lib/domain/errors";

export const metadata: Metadata = { title: "JUZ969fitness", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function QrCheckInPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  let expiresAt = "";
  let error = "";
  try {
    if (!token || token.length > 2048) throw new AppError("請掃描櫃台螢幕上的 QR Code 開始報到。");
    ({ expiresAt } = await verifyCheckInQrToken(token));
  } catch (reason) {
    if (!(reason instanceof AppError)) throw reason;
    error = reason.message;
  }

  let displayName = "";
  if (!error) {
    if (!await getPrincipal()) {
      const returnTo = `/check-in?${new URLSearchParams({ token })}`;
      redirect(`/api/auth/line/start?${new URLSearchParams({ returnTo })}`);
    }
    try {
      displayName = (await requireApiPrincipal()).displayName;
    } catch (reason) {
      if (!(reason instanceof AppError)) throw reason;
      error = reason.message;
    }
  }

  return <><SiteHeader /><main className="main qr-member-page">
    <div className="page-heading"><div><p className="eyebrow">Check in</p><h1>掃碼報到</h1><p className="muted">確認課程後，即可完成今天的報到。</p></div></div>
    {error ? <div className="notice error" role="alert">{error}</div> : <QrCheckInPanel token={token} expiresAt={expiresAt} displayName={displayName} />}
  </main></>;
}
