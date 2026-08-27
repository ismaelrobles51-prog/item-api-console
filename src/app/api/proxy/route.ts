import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";
import { getOperation, securityFor, spec } from "@/lib/openapi";
import { getServerBaseUrl, moduleEnvKey } from "@/lib/connections";

export const runtime = "nodejs";

type ProxyInput = {
  operationId?: string;
  baseUrl?: string;
  parameters?: Record<string, unknown>;
  body?: unknown;
};

function errorResponse(status: number, error: string, durationMs = 0) {
  return NextResponse.json({ ok: false, status, statusText: "Request blocked", durationMs, contentType: "application/json", headers: {}, body: null, error }, { status });
}

function isPrivateIp(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  if (address.startsWith("::ffff:")) address = address.slice(7);
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

async function validateUserBaseUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error("Base URL must be HTTP(S) and cannot contain embedded credentials.");
  if (process.env.ITEM_API_ALLOW_PRIVATE_HOSTS === "true") return;
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.some((entry) => isPrivateIp(entry.address))) throw new Error("Private network targets require ITEM_API_ALLOW_PRIVATE_HOSTS=true on the server.");
}

function addValue(searchParams: URLSearchParams, name: string, value: unknown) {
  if (Array.isArray(value)) value.forEach((item) => searchParams.append(name, String(item)));
  else if (value !== undefined && value !== null) searchParams.set(name, typeof value === "object" ? JSON.stringify(value) : String(value));
}

function applyVerifiedAuthentication(operation: NonNullable<ReturnType<typeof getOperation>>, url: URL, headers: Headers) {
  const requirements = securityFor(operation.operation);
  if (!requirements.length) return;
  const requirement = requirements.find((candidate) => Object.keys(candidate).every((name) => Boolean(spec.components?.securitySchemes?.[name])));
  if (!requirement) throw new Error("The operation authentication scheme cannot be verified from the contract.");
  const prefix = `ITEM_API_${moduleEnvKey(operation.tag)}_`;

  for (const name of Object.keys(requirement)) {
    const scheme = spec.components?.securitySchemes?.[name];
    if (!scheme) throw new Error(`Authentication scheme ${name} is not defined.`);
    const schemeKey = name.replace(/\W/g, "_").toUpperCase();
    if (scheme.type === "apiKey") {
      const value = process.env[`${prefix}${schemeKey}_API_KEY`] || process.env[`${prefix}API_KEY`];
      if (!value || !scheme.name) throw new Error(`Server credential for ${name} is not configured.`);
      if (scheme.in === "header") headers.set(scheme.name, value);
      else if (scheme.in === "query") url.searchParams.set(scheme.name, value);
      else throw new Error(`API key location for ${name} is unsupported.`);
    } else if (scheme.type === "http" && scheme.scheme?.toLowerCase() === "bearer") {
      const token = process.env[`${prefix}BEARER_TOKEN`];
      if (!token) throw new Error("Server bearer token is not configured.");
      headers.set("Authorization", `Bearer ${token}`);
    } else if (scheme.type === "http" && scheme.scheme?.toLowerCase() === "basic") {
      const username = process.env[`${prefix}BASIC_USERNAME`];
      const password = process.env[`${prefix}BASIC_PASSWORD`];
      if (!username || !password) throw new Error("Server basic credentials are not configured.");
      headers.set("Authorization", `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
    } else throw new Error(`Authentication scheme ${name} is not supported by the proxy.`);
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  let input: ProxyInput;
  try {
    input = await request.json();
  } catch {
    return errorResponse(400, "Request payload must be valid JSON.");
  }

  const operation = input.operationId ? getOperation(input.operationId) : undefined;
  if (!operation) return errorResponse(404, "Operation is not present in the bundled OpenAPI contract.");

  const serverBaseUrl = getServerBaseUrl(operation.tag);
  const suppliedBaseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim() : "";
  if (process.env.NODE_ENV === "production" && !serverBaseUrl) return errorResponse(409, "This module has no server-managed base URL.");
  const baseUrl = serverBaseUrl || suppliedBaseUrl;
  if (!baseUrl) return errorResponse(409, "Configure a base URL before sending requests.");

  try {
    if (!serverBaseUrl) await validateUserBaseUrl(baseUrl);
    let path = operation.path;
    const headers = new Headers({ Accept: "application/json" });
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input.parameters ?? {})) {
      const separator = key.indexOf(":");
      const location = key.slice(0, separator);
      const name = key.slice(separator + 1);
      const declared = operation.parameters.some((parameter) => parameter.in === location && parameter.name === name);
      if (!declared) continue;
      if (location === "path") path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
      if (location === "query") addValue(query, name, value);
      if (location === "header" && !["authorization", "cookie", "proxy-authorization"].includes(name.toLowerCase())) headers.set(name, String(value));
    }
    if (/\{[^}]+\}/.test(path)) throw new Error("One or more required path parameters are missing.");
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
    query.forEach((value, name) => url.searchParams.append(name, value));
    applyVerifiedAuthentication(operation, url, headers);

    const hasBody = input.body !== undefined && !["get", "head"].includes(operation.method);
    if (hasBody) headers.set("Content-Type", "application/json");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let upstream: Response;
    try {
      upstream = await fetch(url, { method: operation.method.toUpperCase(), headers, body: hasBody ? JSON.stringify(input.body) : undefined, signal: controller.signal, redirect: "manual", cache: "no-store" });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const text = (await upstream.text()).slice(0, 5_000_000);
    let body: unknown = text;
    if (contentType.includes("json") && text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    const responseHeaders = Object.fromEntries([...upstream.headers.entries()].filter(([name]) => !["set-cookie", "www-authenticate"].includes(name.toLowerCase())));
    return NextResponse.json({ ok: upstream.ok, status: upstream.status, statusText: upstream.statusText, durationMs: Date.now() - started, contentType, headers: responseHeaders, body, requestUrl: url.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.name === "AbortError" ? "The upstream request timed out after 30 seconds." : error.message : "The request could not be sent.";
    return errorResponse(502, message, Date.now() - started);
  }
}
