import Link from "next/link";
import Image from "next/image";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SiteHeader({ navigation }: { navigation?: React.ReactNode }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="RAY Fitness 首頁">
        <Image className="brand-logo" src="/logo.png" alt="RAY Fitness 品牌標誌" width={1179} height={989} sizes="72px" priority />
      </Link>
      <div className="staff-nav-row">
        {navigation ?? (
          <nav className="nav-menu public-theme-nav" aria-label="主題選單">
            <ThemeSwitcher />
          </nav>
        )}
      </div>
    </header>
  );
}
