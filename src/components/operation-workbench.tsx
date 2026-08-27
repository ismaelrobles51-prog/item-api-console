"use client";

import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Clock3, Code2, Copy, ExternalLink, KeyRound, LoaderCircle, Play, Server, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MethodBadge } from "@/components/method-badge";
import type { HttpMethod, Schema } from "@/lib/openapi";

type FormParameter = {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: Schema;
  example?: unknown;
};

type WorkbenchProps = {
  operation: {
    id: string;
    label: string;
    method: HttpMethod;
    path: string;
    tag: string;
    moduleSlug: string;
    description: string;
    deprecated?: boolean;
    parameters: FormParameter[];
    body?: { required?: boolean; description?: string; contentType: string; schema?: Schema; example?: unknown };
    responses: { status: string; description: string; contentType?: string; schema?: Schema }[];
  };
  connection: { baseUrl: string; configured: boolean; source: string; envName: string };
  credential: { required: boolean; configured: boolean; label: string };
  allowBrowserOverrides: boolean;
};

type ApiResult = {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  contentType: string;
  headers: Record<string, string>;
  body: unknown;
  requestUrl?: string;
  error?: string;
};

const storageKey = (tag: string) => `item-api-console:base-url:${tag}`;

function initialValue(schema?: Schema, example?: unknown) {
  const value = example ?? schema?.example ?? schema?.default;
  if (value !== undefined) return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return "";
}

function parseFieldValue(value: string, schema?: Schema) {
  if (value === "") return undefined;
  if (schema?.type === "boolean") return value === "true";
  if (schema?.type === "integer" || schema?.type === "number") return Number(value);
  if (schema?.type === "array" || schema?.type === "object") return JSON.parse(value);
  return value;
}

function SchemaField({ name, schema, required, value, onChange }: { name: string; schema?: Schema; required?: boolean; value: string; onChange: (value: string) => void }) {
  const id = `field-${name.replace(/\W/g, "-")}`;
  const complex = schema?.type === "object" || schema?.type === "array" || Boolean(schema?.properties);
  return (
    <label className={`form-field ${complex ? "wide-field" : ""}`} htmlFor={id}>
      <span className="field-label"><span>{name}</span>{required && <b>Required</b>}<code>{schema?.type ?? "string"}{schema?.format ? ` · ${schema.format}` : ""}</code></span>
      {schema?.enum ? (
        <span className="select-wrap"><select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required}><option value="">Select a value</option>{schema.enum.map((item) => <option key={String(item)} value={String(item)}>{String(item)}</option>)}</select><ChevronDown size={15} /></span>
      ) : schema?.type === "boolean" ? (
        <span className="select-wrap"><select id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required}><option value="">Select a value</option><option value="true">True</option><option value="false">False</option></select><ChevronDown size={15} /></span>
      ) : complex ? (
        <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={schema?.type === "array" ? "[]" : "{}"} rows={5} spellCheck={false} />
      ) : (
        <input id={id} type={schema?.format?.includes("date") ? (schema.format === "date" ? "date" : "datetime-local") : schema?.type === "number" || schema?.type === "integer" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={schema?.description || `Enter ${name}`} required={required} />
      )}
      {schema?.description && <small>{schema.description}</small>}
    </label>
  );
}

function JsonPreview({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(text ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return <div className="json-preview"><button className="copy-button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button><pre>{text || "No response body"}</pre></div>;
}

export function OperationWorkbench({ operation, connection, credential, allowBrowserOverrides }: WorkbenchProps) {
  const [parameterValues, setParameterValues] = useState<Record<string, string>>(() => Object.fromEntries(operation.parameters.map((parameter) => [`${parameter.in}:${parameter.name}`, initialValue(parameter.schema, parameter.example)])));
  const bodyProperties = operation.body?.schema?.properties ?? {};
  const [bodyValues, setBodyValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(bodyProperties).map(([name, schema]) => [name, initialValue(schema)])));
  const [rawBody, setRawBody] = useState(() => initialValue(operation.body?.schema, operation.body?.example));
  const [localBaseUrl, setLocalBaseUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [resultTab, setResultTab] = useState<"body" | "headers">("body");

  useEffect(() => {
    const timeout = window.setTimeout(() => setLocalBaseUrl(window.localStorage.getItem(storageKey(operation.tag)) ?? ""), 0);
    return () => window.clearTimeout(timeout);
  }, [operation.tag]);
  const effectiveBaseUrl = connection.baseUrl || (allowBrowserOverrides ? localBaseUrl : "");
  const ready = Boolean(effectiveBaseUrl) && credential.configured;

  const requestPreview = useMemo(() => {
    let route = operation.path;
    for (const parameter of operation.parameters.filter((item) => item.in === "path")) {
      const value = parameterValues[`path:${parameter.name}`];
      route = route.replace(`{${parameter.name}}`, value ? encodeURIComponent(value) : `{${parameter.name}}`);
    }
    return `${effectiveBaseUrl.replace(/\/$/, "")}${route}`;
  }, [effectiveBaseUrl, operation.parameters, operation.path, parameterValues]);

  const execute = async () => {
    setValidationError("");
    setResult(null);
    const missing = operation.parameters.filter((parameter) => parameter.required && !parameterValues[`${parameter.in}:${parameter.name}`]?.trim());
    if (missing.length) {
      setValidationError(`Complete required field${missing.length > 1 ? "s" : ""}: ${missing.map((item) => item.name).join(", ")}.`);
      return;
    }
    if (!ready) {
      setValidationError("Configure this module connection before sending a request.");
      return;
    }

    try {
      const parameters = Object.fromEntries(Object.entries(parameterValues).filter(([, value]) => value !== "").map(([key, value]) => {
        const parameter = operation.parameters.find((item) => `${item.in}:${item.name}` === key);
        return [key, parseFieldValue(value, parameter?.schema)];
      }));
      let body: unknown;
      if (operation.body) {
        if (Object.keys(bodyProperties).length) {
          const required = operation.body.schema?.required ?? [];
          const missingBody = required.filter((name) => !bodyValues[name]?.trim());
          if (missingBody.length) throw new Error(`Complete required body field${missingBody.length > 1 ? "s" : ""}: ${missingBody.join(", ")}.`);
          body = Object.fromEntries(Object.entries(bodyValues).filter(([, value]) => value !== "").map(([name, value]) => [name, parseFieldValue(value, bodyProperties[name])]));
        } else if (rawBody.trim()) body = JSON.parse(rawBody);
        else if (operation.body.required) throw new Error("A request body is required.");
      }
      setLoading(true);
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: operation.id, baseUrl: connection.baseUrl || !allowBrowserOverrides ? undefined : localBaseUrl, parameters, body }),
      });
      const payload = await response.json() as ApiResult;
      setResult(payload);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "The request could not be prepared.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-page page-container">
      <div className="breadcrumb"><Link href="/">Modules</Link><span>/</span><Link href={`/modules/${operation.moduleSlug}`}>{operation.tag}</Link><span>/</span><span>{operation.label}</span></div>
      <header className="operation-header">
        <div className="operation-heading-line"><MethodBadge method={operation.method} /><div><h1>{operation.label}</h1><code>{operation.path}</code></div></div>
        {operation.description && <p className="operation-description">{operation.description}</p>}
        <div className="operation-meta">
          <span><ShieldCheck size={15} /> {credential.label}</span>
          <span><Server size={15} /> {connection.configured ? connection.source : allowBrowserOverrides && localBaseUrl ? "Browser override" : "No base URL"}</span>
          {operation.deprecated && <span className="warning-chip"><AlertTriangle size={15} /> Deprecated</span>}
        </div>
      </header>

      <div className="workbench-layout">
        <div className="request-panel tool-panel">
          <div className="panel-title"><div><p className="eyebrow">Request builder</p><h2>Configure request</h2></div><Code2 size={19} /></div>
          {!ready && <div className="connection-notice"><span className="notice-icon"><KeyRound size={18} /></span><div><strong>Connection pending</strong><p>{effectiveBaseUrl ? credential.label : "No base URL is configured for this module."}</p><Link href="/settings">Open connection settings <ExternalLink size={13} /></Link></div></div>}

          {operation.parameters.length > 0 && <div className="form-section"><div className="form-section-title"><span>Parameters</span><span>{operation.parameters.length}</span></div><div className="form-grid">{operation.parameters.map((parameter) => <SchemaField key={`${parameter.in}:${parameter.name}`} name={parameter.name} schema={parameter.schema} required={parameter.required} value={parameterValues[`${parameter.in}:${parameter.name}`] ?? ""} onChange={(value) => setParameterValues((current) => ({ ...current, [`${parameter.in}:${parameter.name}`]: value }))} />)}</div></div>}

          {operation.body && <div className="form-section"><div className="form-section-title"><span>Request body</span><code>{operation.body.contentType}</code></div>{operation.body.description && <p className="section-description">{operation.body.description}</p>}{Object.keys(bodyProperties).length ? <div className="form-grid">{Object.entries(bodyProperties).map(([name, schema]) => <SchemaField key={name} name={name} schema={schema} required={operation.body?.schema?.required?.includes(name)} value={bodyValues[name] ?? ""} onChange={(value) => setBodyValues((current) => ({ ...current, [name]: value }))} />)}</div> : <label className="form-field wide-field"><span className="field-label"><span>JSON body</span>{operation.body.required && <b>Required</b>}</span><textarea rows={10} value={rawBody} onChange={(event) => setRawBody(event.target.value)} placeholder="{}" spellCheck={false} /></label>}</div>}

          {!operation.parameters.length && !operation.body && <div className="no-input-state"><Check size={17} /><span>This operation does not declare any request inputs.</span></div>}
          <div className="request-target"><span>Target</span><code>{requestPreview || "Base URL not configured"}</code></div>
          {validationError && <div className="inline-error" role="alert"><AlertTriangle size={16} />{validationError}</div>}
          <button className="execute-button" disabled={loading || !ready} onClick={execute}>{loading ? <LoaderCircle className="spin" size={17} /> : <Play size={16} fill="currentColor" />}{loading ? "Sending request" : "Send request"}</button>
        </div>

        <div className="response-column">
          <section className="tool-panel result-panel">
            <div className="panel-title"><div><p className="eyebrow">Response</p><h2>Live result</h2></div>{result && <span className={`status-code ${result.ok ? "success" : "error"}`}>{result.status || "Error"}</span>}</div>
            {!result ? <div className="pending-result"><span className="pending-visual"><span /></span><h3>{ready ? "Ready to run" : "Awaiting connection"}</h3><p>{ready ? "Complete the request fields and send when ready." : "A real API response will appear here after a connection is configured."}</p></div> : <><div className="result-summary"><span><Clock3 size={14} /> {result.durationMs} ms</span><span>{result.contentType || "Unknown content type"}</span></div><div className="result-tabs"><button className={resultTab === "body" ? "active" : ""} onClick={() => setResultTab("body")}>Body</button><button className={resultTab === "headers" ? "active" : ""} onClick={() => setResultTab("headers")}>Headers</button></div>{result.error && <div className="inline-error"><AlertTriangle size={16} />{result.error}</div>}<JsonPreview data={resultTab === "body" ? result.body : result.headers} /></>}
          </section>

          <section className="tool-panel response-models"><div className="panel-title"><div><p className="eyebrow">Contract</p><h2>Declared responses</h2></div><span className="result-count">{operation.responses.length}</span></div><div className="response-list">{operation.responses.map((response) => <details key={response.status}><summary><span className={`response-status status-${response.status[0]}`}>{response.status}</span><span>{response.description}</span><ChevronDown size={15} /></summary><div><code>{response.contentType ?? "No response body declared"}</code>{response.schema && <pre>{JSON.stringify(response.schema, null, 2)}</pre>}</div></details>)}</div></section>
        </div>
      </div>
    </div>
  );
}
