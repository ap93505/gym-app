import { CheckInPanelV2 } from "@/components/CheckInPanelV2";

export default function CheckInPage() {
  return <main className="main" style={{ maxWidth: 760, margin: "0 auto" }}><div className="page-heading"><div><p className="eyebrow">Check in</p><h1>打卡上課</h1><p className="muted">可報到與即將到來的課程都會顯示在此。</p></div></div><CheckInPanelV2 /></main>;
}
