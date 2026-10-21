import { SchedulingSettings } from "@/components/SchedulingSettings";
import { requirePagePrincipal } from "@/lib/auth/session";
import { getSchedulingSettings } from "@/lib/services/settings";

export default async function SettingsPage() {
  await requirePagePrincipal(["admin"]);
  const settings = await getSchedulingSettings();
  return <main className="main">
    <div className="page-heading"><div><p className="eyebrow">Settings</p><h1>預約設定</h1><p className="muted">調整全館同一時段可安排的課程數。</p></div></div>
    <SchedulingSettings initialCapacity={settings.slotCapacity} />
  </main>;
}
