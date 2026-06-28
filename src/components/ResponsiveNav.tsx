"use client";

import Link from "next/link";
import { useState } from "react";

type NavItem = { href: string; label: string; dot?: boolean };

export function ResponsiveNav({ items, showLogout = false }: { items: NavItem[]; showLogout?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="responsive-nav">
      <button
        type="button"
        className="nav-toggle"
        aria-label="切換選單"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav className={`nav-menu ${open ? "is-open" : ""}`} aria-label="主要選單">
        {items.map((item) => (
          <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
            <span className="nav-label">{item.label}{item.dot && <span className="nav-dot" aria-label="有待確認課程" />}</span>
          </Link>
        ))}
        {showLogout && (
          <form action="/api/auth/logout" method="post">
            <button className="button secondary small">登出</button>
          </form>
        )}
      </nav>
    </div>
  );
}
