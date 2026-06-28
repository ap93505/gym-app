import type { SessionPrincipal } from "@/lib/domain/types";
import { ResponsiveNav } from "./ResponsiveNav";

export function AppNav({ principal }: { principal: SessionPrincipal }) {
  const staff = principal.roles.some((role) => role === "admin" || role === "coach");
  const items = [
    { href: "/member/account", label: "帳號資訊" },
    { href: "/member/check-in", label: "打卡上課" },
    { href: "/member/calendar", label: "我的預約" },
    ...(staff ? [{ href: "/dashboard", label: "管理後台" }] : []),
  ];
  return (
    <ResponsiveNav items={items} showLogout />
  );
}
