import { ProfileCardEditor } from "@/components/ProfileCardEditor";
import { requirePagePrincipal } from "@/lib/auth/session";
import { getUser } from "@/lib/services/users";

export default async function AccountPage() {
  const principal = await requirePagePrincipal();
  const user = await getUser(principal.userId);
  return (
    <main className="main">
      <div className="page-heading"><div><p className="eyebrow">My account</p><h1>帳號資訊</h1><p className="muted">你好，{user.nickname || user.displayName}。</p></div></div>
      <ProfileCardEditor profile={user} />
    </main>
  );
}
