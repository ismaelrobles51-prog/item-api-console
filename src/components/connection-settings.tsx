"use client";

import Link from "next/link";
import { Check, ChevronDown, CircleAlert, ExternalLink, KeyRound, LockKeyhole, Search, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ConnectionItem = {
  name: string;
  label: string;
  slug: string;
  operationCount: number;
  configured: boolean;
  baseUrl: string;
  source: string;
  envName: string;
};

const storageKey = (tag: string) => `item-api-console:base-url:${tag}`;

function ConnectionRow({ item, allowBrowserOverrides }: { item: ConnectionItem; allowBrowserOverrides: boolean }) {
  const [override, setOverride] = useState("");
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const serverManaged = item.configured;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const value = window.localStorage.getItem(storageKey(item.name)) ?? "";
      setOverride(value);
      setDraft(value);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [item.name]);

  const save = () => {
    const value = draft.trim().replace(/\/$/, "");
    setError("");
    try {
      if (value) {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        window.localStorage.setItem(storageKey(item.name), value);
      } else window.localStorage.removeItem(storageKey(item.name));
      setOverride(value);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      setSaved(false);
      setError("Enter a valid HTTP or HTTPS base URL.");
    }
  };

  const effective = item.baseUrl || (allowBrowserOverrides ? override : "");
  return <details className="connection-row">
    <summary>
      <span className={`connection-state-icon ${effective ? "ready" : "pending"}`}>{effective ? <Check size={15} /> : <CircleAlert size={15} />}</span>
      <span className="connection-name"><strong>{item.label}</strong><small>{item.operationCount} operations</small></span>
      <span className={`connection-state-label ${effective ? "ready" : "pending"}`}>{effective ? (serverManaged ? "Environment" : "Local override") : "Pending"}</span>
      <ChevronDown size={16} />
    </summary>
    <div className="connection-detail">
      <div className="setting-field">
        <label htmlFor={`url-${item.slug}`}>Base URL</label>
        {serverManaged ? <div className="managed-value"><Server size={16} /><code>{item.baseUrl}</code><span>Server managed</span></div> : allowBrowserOverrides ? <div className="url-input-row"><input id={`url-${item.slug}`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="https://api.example.com" inputMode="url" /><button onClick={save}>{saved ? <Check size={15} /> : null}{saved ? "Saved" : "Save locally"}</button></div> : <div className="managed-value unavailable"><Server size={16} /><code>Not configured</code><span>Environment required</span></div>}
        <p>{serverManaged ? `Loaded from ${item.source}. Browser overrides are disabled while a server URL is present.` : allowBrowserOverrides ? "Stored only in this browser for local development. Production deployments require the environment variable below." : "Production connections are server-managed. Add the environment variable below and restart the application."}</p>{error && <div className="setting-error" role="alert">{error}</div>}
      </div>
      <div className="env-instruction"><span><LockKeyhole size={15} /> Production environment</span><code>{item.envName}=https://api.example.com</code></div>
      <div className="credential-line"><span className="credential-icon"><ShieldCheck size={16} /></span><div><strong>No credential required by contract</strong><p>All operations in this specification declare <code>security: []</code>. The proxy will not attach an undeclared API key or token.</p></div></div>
      <Link href={`/modules/${item.slug}`} className="text-link">Open module <ExternalLink size={13} /></Link>
    </div>
  </details>;
}

export function ConnectionSettings({ items, allowBrowserOverrides }: { items: ConnectionItem[]; allowBrowserOverrides: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "configured">("all");
  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = item.label.toLowerCase().includes(query.toLowerCase());
    if (filter === "configured") return matchesQuery && item.configured;
    if (filter === "pending") return matchesQuery && !item.configured;
    return matchesQuery;
  }), [filter, items, query]);

  return <>
    <div className="security-callout"><span className="security-callout-icon"><KeyRound size={20} /></span><div><strong>Secrets stay on the server</strong><p>This contract does not define an authentication scheme. When a future verified scheme is present, credentials must be supplied through server environment variables and are never returned to the browser.</p></div></div>
    <div className="settings-toolbar"><label className="catalog-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a module" /></label><div className="segmented-control"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "configured" ? "active" : ""} onClick={() => setFilter("configured")}>Configured</button><button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Pending</button></div></div>
    <div className="connections-list">{filtered.map((item) => <ConnectionRow item={item} allowBrowserOverrides={allowBrowserOverrides} key={item.name} />)}{!filtered.length && <div className="empty-state"><Search size={22} /><h3>No modules found</h3><p>Try another name or status filter.</p></div>}</div>
  </>;
}
