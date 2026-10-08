"use client";

import { useEffect, useRef, useState } from "react";

type QrCode = { image: string; expiresAt: string; refreshAfterSeconds: number };

export function AdminCheckInQr() {
  const [qr, setQr] = useState<QrCode | null>(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let nextRefresh = 0;
    let busy = false;
    let validUntil = 0;
    async function refresh() {
      if (busy) return;
      busy = true;
      setLoading(true);
      try {
        const response = await fetch("/api/admin/check-in-qr", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "QR Code 載入失敗");
        if (controller.signal.aborted) return;
        setQr(body);
        setError("");
        validUntil = Date.parse(body.expiresAt);
        nextRefresh = Date.now() + body.refreshAfterSeconds * 1000;
        setSeconds(body.refreshAfterSeconds);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "連線失敗，正在嘗試重新連線。");
        nextRefresh = Date.now() + 10_000;
      } finally {
        busy = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void refresh();
    const tick = () => {
      if (controller.signal.aborted) return;
      if (validUntil && Date.now() >= validUntil) setQr(null);
      setSeconds(Math.max(0, Math.ceil((nextRefresh - Date.now()) / 1000)));
      if (Date.now() >= nextRefresh) void refresh();
    };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [retry]);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await panel.current?.requestFullscreen();
    } catch {
      setError("此瀏覽器無法開啟全螢幕，仍可直接掃描報到。");
    }
  }

  return <div className="card stack qr-display" ref={panel}>
    <div><span className="badge">會員報到</span><h2>掃描 QR Code，準備上課</h2><p className="muted">使用手機相機掃描 → LINE 登入 → 確認報到</p></div>
    {qr ? <div className="qr-image-frame">
      {/* Locally generated data URL; never sent to an external QR service. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.image} width={640} height={640} alt="會員課程報到 QR Code" />
    </div> : <div className="qr-placeholder">{loading ? "正在產生 QR Code…" : "暫時無法顯示 QR Code，請重新整理。"}</div>}
    <p className="muted">{loading ? "正在更新…" : `${seconds} 秒後自動更新`} · 連結自產生起有效 10 分鐘</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="actions qr-actions"><button className="button secondary" disabled={loading} onClick={() => { setQr(null); setRetry((value) => value + 1); }}>重新整理</button><button className="button" onClick={fullscreen}>切換全螢幕</button></div>
  </div>;
}
