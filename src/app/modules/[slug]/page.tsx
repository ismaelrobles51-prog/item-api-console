import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Cable, CircleDot, FileInput, RadioTower } from "lucide-react";
import { OperationCatalog } from "@/components/operation-catalog";
import { connectionStatus } from "@/lib/connections";
import { firstDescription, getModule, getModuleOperations } from "@/lib/openapi";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const apiModule = getModule(slug);
  if (!apiModule) notFound();
  const moduleOperations = getModuleOperations(apiModule.name);
  const connection = connectionStatus(apiModule.name);
  const bodyCount = moduleOperations.filter((operation) => operation.operation.requestBody).length;
  const parameterCount = moduleOperations.reduce((total, operation) => total + operation.parameters.length, 0);

  return (
    <div className="page-container module-page">
      <div className="breadcrumb"><Link href="/">Modules</Link><span>/</span><span>{apiModule.label}</span></div>
      <header className="module-header">
        <div className="module-kicker"><span>{apiModule.label.slice(0, 2).toUpperCase()}</span> Business module</div>
        <div className="module-title-row"><div><h1>{apiModule.label}</h1><p>{apiModule.description || `Manage and inspect ${apiModule.label.toLowerCase()} operations defined by the current API contract.`}</p></div><Link href="/settings" className={`connection-summary ${connection.configured ? "ready" : "pending"}`}><span className="connection-summary-icon"><Cable size={19} /></span><span><small>Connection</small><strong>{connection.configured ? "Ready" : "Setup required"}</strong></span><ArrowRight size={16} /></Link></div>
      </header>
      <section className="module-stats">
        <div><RadioTower size={17} /><span><strong>{apiModule.operationCount}</strong> Operations</span></div>
        <div><CircleDot size={17} /><span><strong>{apiModule.readCount}</strong> Read paths</span></div>
        <div><FileInput size={17} /><span><strong>{bodyCount}</strong> Request bodies</span></div>
        <div><span className="hash-icon">#</span><span><strong>{parameterCount}</strong> Parameters</span></div>
      </section>
      <OperationCatalog operations={moduleOperations.map((operation) => ({ id: operation.id, label: operation.label, method: operation.method, path: operation.path, description: firstDescription(operation.operation.description), deprecated: operation.operation.deprecated }))} />
    </div>
  );
}
