"use client";

import Link from "next/link";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MethodBadge } from "@/components/method-badge";
import type { HttpMethod } from "@/lib/openapi";

type CatalogOperation = {
  id: string;
  label: string;
  method: HttpMethod;
  path: string;
  description: string;
  deprecated?: boolean;
};

const FILTER_KEY = "item-api-console:method-filter";

export function OperationCatalog({ operations }: { operations: CatalogOperation[] }) {
  const methods = Array.from(new Set(operations.map((operation) => operation.method)));
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem(FILTER_KEY);
      if (saved && (saved === "all" || methods.includes(saved as HttpMethod))) setMethod(saved);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [methods]);

  const setMethodFilter = (next: string) => {
    setMethod(next);
    window.localStorage.setItem(FILTER_KEY, next);
  };

  const filtered = useMemo(() => operations.filter((operation) => {
    const matchesMethod = method === "all" || operation.method === method;
    const haystack = `${operation.label} ${operation.path} ${operation.description}`.toLowerCase();
    return matchesMethod && haystack.includes(query.trim().toLowerCase());
  }), [method, operations, query]);

  return (
    <section className="catalog-section">
      <div className="section-heading-row">
        <div><p className="eyebrow">Operations catalog</p><h2>Explore endpoints</h2></div>
        <span className="result-count">{filtered.length} of {operations.length}</span>
      </div>
      <div className="catalog-toolbar">
        <label className="catalog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by task, route, or endpoint" /></label>
        <div className="method-filters" aria-label="Filter by method">
          <SlidersHorizontal size={15} />
          <button className={method === "all" ? "active" : ""} onClick={() => setMethodFilter("all")}>All</button>
          {methods.map((item) => <button key={item} className={method === item ? "active" : ""} onClick={() => setMethodFilter(item)}>{item.toUpperCase()}</button>)}
        </div>
      </div>
      <div className="operation-list">
        {filtered.map((operation) => (
          <Link className="operation-row" href={`/operations/${operation.id}`} key={operation.id}>
            <MethodBadge method={operation.method} />
            <div className="operation-copy">
              <div className="operation-title">{operation.label}{operation.deprecated && <span className="deprecated-tag">Deprecated</span>}</div>
              <code>{operation.path}</code>
              {operation.description && <p>{operation.description}</p>}
            </div>
            <span className="open-operation"><ArrowRight size={17} /></span>
          </Link>
        ))}
        {!filtered.length && <div className="empty-state"><Search size={22} /><h3>No matching operations</h3><p>Adjust the search term or method filter.</p></div>}
      </div>
    </section>
  );
}
