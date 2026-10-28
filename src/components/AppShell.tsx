"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { no: string; label: string; href: string };

/**
 * 应用外壳：左侧档案索引 + 主区。
 * 专注模式（隐藏侧栏、内容铺满）在项目内与首页通用。
 */
export default function AppShell({
  title,
  subtitle,
  foot,
  items,
  children,
}: {
  title: string;
  subtitle?: string;
  foot?: React.ReactNode;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [focus, setFocus] = useState(false);
  return (
    <div className={`app${focus ? " focus" : ""}`}>
      <button className="exitfocus" type="button" onClick={() => setFocus(false)}>
        ⤡ 退出专注
      </button>
      <aside className="side">
        <div className="logo">
          <b>{title}</b>
          {subtitle && <span>{subtitle}</span>}
          <button className="focusbtn" type="button" onClick={() => setFocus((v) => !v)}>
            {focus ? "⤡ 退出专注" : "⤢ 专注"}
          </button>
        </div>
        <nav>
          {items.map((it) => (
            <Link key={it.href} href={it.href} className={pathname === it.href ? "on" : ""}>
              <span className="no">{it.no}</span>
              <span className="lbl">{it.label}</span>
            </Link>
          ))}
        </nav>
        {foot && <div className="foot">{foot}</div>}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
