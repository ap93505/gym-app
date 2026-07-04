import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SiteHeader({ navigation }: { navigation?: React.ReactNode }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">R</span>
        <span>RAY FITNESS</span>
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
