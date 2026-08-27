import Link from "next/link";
import { ArrowRight, Braces, Cable, Layers3, ShieldCheck } from "lucide-react";
import { connectionStatus } from "@/lib/connections";
import { groupName, modules, operations, spec } from "@/lib/openapi";

export default function HomePage() {
  const groups = Object.entries(modules.reduce<Record<string, typeof modules>>((result, module) => {
    const group = groupName(module.name);
    (result[group] ??= []).push(module);
    return result;
  }, {}));
  const configured = modules.filter((module) => connectionStatus(module.name).configured).length;

  return (
    <div className="page-container home-page">
      <header className="home-header">
        <div>
          <div className="system-label"><span className="pulse-dot" /> API operations workspace</div>
          <h1>Good morning.<br /><span>Your systems, in one place.</span></h1>
          <p>Browse the live contract, configure module connections, and run declared operations from a controlled workspace.</p>
        </div>
        <Link className="primary-link" href="/settings"><Cable size={16} /> Configure connections <ArrowRight size={15} /></Link>
      </header>

      <section className="metrics-band" aria-label="Contract summary">
        <div><span className="metric-icon"><Layers3 size={18} /></span><div><strong>{modules.length}</strong><span>Business modules</span></div></div>
        <div><span className="metric-icon"><Braces size={18} /></span><div><strong>{operations.length}</strong><span>Declared operations</span></div></div>
        <div><span className="metric-icon"><ShieldCheck size={18} /></span><div><strong>{Object.keys(spec.components?.schemas ?? {}).length}</strong><span>Data models</span></div></div>
        <div><span className="metric-icon connection"><Cable size={18} /></span><div><strong>{configured}<small> / {modules.length}</small></strong><span>Modules connected</span></div></div>
      </section>

      <section className="modules-section">
        <div className="section-heading-row">
          <div><p className="eyebrow">OpenAPI modules</p><h2>Choose a workspace</h2></div>
          <span className="contract-note">Contract v{spec.info.version} · {spec.openapi}</span>
        </div>
        {groups.map(([group, groupModules]) => groupModules && (
          <div className="module-group" key={group}>
            <div className="module-group-heading"><h3>{group}</h3><span>{groupModules.length} modules</span></div>
            <div className="module-grid">
              {groupModules.map((module, index) => {
                const connection = connectionStatus(module.name);
                return <Link href={`/modules/${module.slug}`} className="module-card" key={module.name}>
                  <div className="module-card-top"><span className="module-index">{String(index + 1).padStart(2, "0")}</span><span className={`connection-pill ${connection.configured ? "connected" : "pending"}`}><span />{connection.configured ? "Connected" : "Pending"}</span></div>
                  <h4>{module.label}</h4>
                  <p>{module.operationCount} operations across {module.readCount} reads and {module.writeCount} writes.</p>
                  <div className="module-card-footer"><span>{module.operationCount} endpoints</span><ArrowRight size={16} /></div>
                </Link>;
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
