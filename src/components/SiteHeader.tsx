import Link from "next/link";

export function SiteHeader({ navigation }: { navigation?: React.ReactNode }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">R</span>
        <span>RAY FITNESS</span>
      </Link>
      {navigation && <div className="staff-nav-row">{navigation}</div>}
    </header>
  );
}
