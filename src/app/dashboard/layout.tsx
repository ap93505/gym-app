import { StaffNav } from "@/components/StaffNav";
import { SiteHeader } from "@/components/SiteHeader";
import { requirePagePrincipal } from "@/lib/auth/session";
import { pendingConfirmations } from "@/lib/services/sessions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePagePrincipal(["admin", "coach"]);
  const pendingCount = (await pendingConfirmations(principal).catch(() => [])).length;
  return <><SiteHeader navigation={<StaffNav principal={principal} pendingCount={pendingCount} />} />{children}</>;
}
