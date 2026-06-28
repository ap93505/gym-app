import { StaffCalendarV2 } from "@/components/StaffCalendarV2";

export default function StaffCalendarPage() {
  return <main className="main"><div className="page-heading"><div><p className="eyebrow">All schedules</p><h1>全館行事曆</h1><p className="muted">拖曳教練與學生配對建立課程；點擊既有課程後才可編輯。</p></div></div><StaffCalendarV2 /></main>;
}
