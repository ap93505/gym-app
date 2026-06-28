import type { SessionPrincipal } from "@/lib/domain/types";
import { ResponsiveNav } from "./ResponsiveNav";

export function StaffNav({ principal, pendingCount = 0 }: { principal: SessionPrincipal; pendingCount?: number }) {
  const admin = principal.roles.includes("admin");
  const items = [
    { href: "/dashboard", label: "總覽" },
    { href: "/dashboard/calendar", label: "行事曆" },
    { href: "/dashboard/pending", label: "待確認", dot: pendingCount > 0 },
    ...(admin ? [
      { href: "/dashboard/members", label: "會員" },
      { href: "/dashboard/plans", label: "方案" },
      { href: "/dashboard/reports", label: "報表" },
    ] : []),
    { href: "/member/account", label: "會員端" },
  ];
  return <ResponsiveNav items={items} />;
}
