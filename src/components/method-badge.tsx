import type { HttpMethod } from "@/lib/openapi";

export function MethodBadge({ method, compact = false }: { method: HttpMethod; compact?: boolean }) {
  return <span className={`method-badge method-${method} ${compact ? "compact" : ""}`}>{method.toUpperCase()}</span>;
}
