import { MemberSchedule } from "@/components/MemberSchedule";

export default function MemberCalendarPage() {
  return <main className="main"><div className="page-heading"><div><p className="eyebrow">My schedule</p><h1>我的預約</h1><p className="muted">從個人行事曆查看預約與報到狀態，點擊課程可查看細節。</p></div></div><MemberSchedule /></main>;
}
