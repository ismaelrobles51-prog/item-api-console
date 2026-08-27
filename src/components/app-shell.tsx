"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Menu, PanelLeftClose, Search, Settings, X } from "lucide-react";
import { useMemo, useState } from "react";

type ModuleNavItem = { name: string; label: string; slug: string; operationCount: number };

function navigationGroup(tag: string) {
  const lower = tag.toLowerCase();
  if (lower.includes("trip") || lower.includes("dispatch") || lower.includes("linehaul") || lower.includes("loadmaster")) return "Fleet & dispatch";
  if (lower.includes("shipment") || lower.startsWith("order") || lower.includes("revenue") || lower.includes("pro-no")) return "Orders & shipment";
  if (lower.includes("task") || lower.includes("appointment") || lower.includes("openjob")) return "Tasks & appointments";
  return "Network & services";
}

export function AppShell({ modules, children }: { modules: ModuleNavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const filtered = modules.filter((module) => module.label.toLowerCase().includes(query.toLowerCase()));
    return filtered.reduce<Record<string, ModuleNavItem[]>>((result, module) => {
      const group = navigationGroup(module.name);
      (result[group] ??= []).push(module);
      return result;
    }, {});
  }, [modules, query]);

  const sidebar = (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="brand-row">
        <Link href="/" className="brand" aria-label="Item AI API operations">
          <span className="brand-mark"><span /></span>
          {!collapsed && <span className="brand-wordmark">ITEM <b>AI</b></span>}
        </Link>
        <button className="icon-button sidebar-toggle" onClick={() => setCollapsed((value) => !value)} aria-label="Toggle navigation" title="Toggle navigation">
          <PanelLeftClose size={17} />
        </button>
        <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>

      {!collapsed && (
        <div className="nav-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a module" aria-label="Find a module" />
          <kbd>⌘K</kbd>
        </div>
      )}

      <nav className="module-nav" aria-label="API modules">
        <Link className={`nav-overview ${pathname === "/" ? "active" : ""}`} href="/" onClick={() => setMobileOpen(false)}>
          <Boxes size={16} />
          {!collapsed && <><span>All modules</span><span className="nav-count">{modules.length}</span></>}
        </Link>
        {!collapsed && Object.entries(groups).map(([group, items]) => items && (
          <div className="nav-group" key={group}>
            <div className="nav-group-label">{group}</div>
            {items.map((module) => {
              const active = pathname.includes(`/modules/${module.slug}`);
              return (
                <Link key={module.name} className={`nav-module ${active ? "active" : ""}`} href={`/modules/${module.slug}`} onClick={() => setMobileOpen(false)}>
                  <span>{module.label}</span><span className="nav-count">{module.operationCount}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link className={`settings-link ${pathname === "/settings" ? "active" : ""}`} href="/settings" onClick={() => setMobileOpen(false)}>
          <Settings size={16} />{!collapsed && <span>Connections</span>}
        </Link>
        {!collapsed && <div className="contract-version"><span className="status-dot" /> OpenAPI 3.0.1 <span>v1.0.0</span></div>}
      </div>
    </aside>
  );

  return (
    <div className="app-shell">
      <div className={`mobile-backdrop ${mobileOpen ? "visible" : ""}`} onClick={() => setMobileOpen(false)} />
      <div className={`desktop-sidebar ${collapsed ? "is-collapsed" : ""}`}>{sidebar}</div>
      <div className={`mobile-sidebar ${mobileOpen ? "is-open" : ""}`}>{sidebar}</div>
      <main className={`main-area ${collapsed ? "with-collapsed-sidebar" : ""}`}>
        <div className="mobile-topbar">
          <button className="icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <span className="brand-wordmark">ITEM <b>AI</b></span>
          <Link href="/settings" className="icon-button" aria-label="Connections"><Settings size={19} /></Link>
        </div>
        {children}
      </main>
    </div>
  );
}
