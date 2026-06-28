import { AppNav } from "@/components/AppNav";
import { SiteHeader } from "@/components/SiteHeader";
import { requirePagePrincipal } from "@/lib/auth/session";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePagePrincipal();
  return (
    <>
      <SiteHeader navigation={<AppNav principal={principal} />} />
      {children}
    </>
  );
}
