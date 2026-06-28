import { PendingConfirmations } from "@/components/PendingConfirmations";

export default function PendingPage() {
  return <main className="main"><div className="page-heading"><div><p className="eyebrow">After class</p><h1>待確認課程</h1><p className="muted">課程結束後由該堂教練確認完成；未完成時必須記錄原因。</p></div></div><PendingConfirmations /></main>;
}
