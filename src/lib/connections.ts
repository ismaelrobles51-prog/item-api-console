import { moduleSlug, securityFor, spec, type OperationRecord } from "@/lib/openapi";

export function moduleEnvKey(tag: string) {
  return moduleSlug(tag).replace(/-/g, "_").toUpperCase();
}

export function baseUrlEnvName(tag: string) {
  return `ITEM_API_${moduleEnvKey(tag)}_BASE_URL`;
}

export function getServerBaseUrl(tag: string) {
  return process.env[baseUrlEnvName(tag)] || process.env.ITEM_API_BASE_URL || spec.servers?.[0]?.url || "";
}

export function connectionStatus(tag: string) {
  const baseUrl = getServerBaseUrl(tag);
  return {
    baseUrl,
    configured: Boolean(baseUrl),
    source: process.env[baseUrlEnvName(tag)] ? "module environment" : process.env.ITEM_API_BASE_URL ? "shared environment" : spec.servers?.[0]?.url ? "OpenAPI contract" : "not configured",
    envName: baseUrlEnvName(tag),
  };
}

export function credentialStatus(operation: OperationRecord) {
  const requirements = securityFor(operation.operation);
  if (!requirements.length) return { required: false, configured: true, label: "No authentication declared" };

  const prefix = `ITEM_API_${moduleEnvKey(operation.tag)}_`;
  const requiredSchemes = Object.keys(requirements[0] ?? {});
  const configured = requiredSchemes.every((name) => {
    const scheme = spec.components?.securitySchemes?.[name];
    if (scheme?.type === "apiKey") return Boolean(process.env[`${prefix}${name.replace(/\W/g, "_").toUpperCase()}_API_KEY`] || process.env[`${prefix}API_KEY`]);
    if (scheme?.type === "http" && scheme.scheme?.toLowerCase() === "bearer") return Boolean(process.env[`${prefix}BEARER_TOKEN`]);
    if (scheme?.type === "http" && scheme.scheme?.toLowerCase() === "basic") return Boolean(process.env[`${prefix}BASIC_USERNAME`] && process.env[`${prefix}BASIC_PASSWORD`]);
    return false;
  });
  return { required: true, configured, label: configured ? "Server credential configured" : "Server credential missing" };
}
