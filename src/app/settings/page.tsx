import Link from "next/link";
import { ConnectionSettings } from "@/components/connection-settings";
import { connectionStatus } from "@/lib/connections";
import { modules } from "@/lib/openapi";

export default function SettingsPage() {
  const items = modules.map((module) => ({ ...module, ...connectionStatus(module.name) }));
  return <div className="page-container settings-page">
    <div className="breadcrumb"><Link href="/">Modules</Link><span>/</span><span>Connections</span></div>
    <header className="settings-header"><p className="eyebrow">Workspace settings</p><h1>Connections</h1><p>Set module endpoints and inspect server-managed credential readiness.</p></header>
    <ConnectionSettings items={items} allowBrowserOverrides={process.env.NODE_ENV !== "production"} />
  </div>;
}
