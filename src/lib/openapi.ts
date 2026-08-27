import contract from "@/data/openapi.json";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head" | "trace";

export type Schema = {
  $ref?: string;
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  default?: unknown;
  example?: unknown;
  enum?: unknown[];
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  additionalProperties?: boolean | Schema;
  minimum?: number;
  maximum?: number;
};

export type Parameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: Schema;
  example?: unknown;
};

export type Operation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated?: boolean;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    description?: string;
    content?: Record<string, { schema?: Schema; example?: unknown }>;
  };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: Schema }> }>;
  security?: Record<string, string[]>[];
};

type Contract = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  tags?: { name: string; description?: string }[];
  servers?: { url: string; description?: string }[];
  security?: Record<string, string[]>[];
  paths: Record<string, Partial<Record<HttpMethod, Operation>> & { parameters?: Parameter[] }>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, {
      type: string;
      scheme?: string;
      in?: string;
      name?: string;
      bearerFormat?: string;
    }>;
  };
};

export const spec = contract as Contract;
export const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete", "options", "head", "trace"];

export type OperationRecord = {
  id: string;
  path: string;
  method: HttpMethod;
  tag: string;
  label: string;
  operation: Operation;
  parameters: Parameter[];
};

function englishLine(value?: string) {
  if (!value) return "";
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /^[\x00-\x7F]+$/.test(line) && /[A-Za-z]{3}/.test(line)) ?? lines[0] ?? "";
}

export function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function operationLabel(operation: Operation, method: HttpMethod, path: string) {
  const fromSummary = englishLine(operation.summary);
  if (fromSummary && !fromSummary.startsWith("/")) return fromSummary.replace(/\s*\(.*?API\)\s*$/i, "").trim();
  if (operation.operationId) return humanize(operation.operationId);
  const segment = path.split("/").filter(Boolean).at(-1)?.replace(/\{(.+?)\}/g, "$1") ?? "operation";
  return `${humanize(method)} ${humanize(segment)}`;
}

function makeOperationId(method: HttpMethod, path: string) {
  return Buffer.from(`${method}:${path}`).toString("base64url");
}

export const operations: OperationRecord[] = Object.entries(spec.paths).flatMap(([path, pathItem]) =>
  HTTP_METHODS.flatMap((method) => {
    const operation = pathItem[method];
    if (!operation) return [];
    const tag = operation.tags?.[0] ?? "Untagged";
    return [{
      id: makeOperationId(method, path),
      path,
      method,
      tag,
      label: operationLabel(operation, method, path),
      operation,
      parameters: [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])],
    }];
  }),
);

export const modules = (spec.tags ?? []).map((tag) => {
  const moduleOperations = operations.filter((operation) => operation.tag === tag.name);
  return {
    name: tag.name,
    label: humanize(tag.name),
    slug: moduleSlug(tag.name),
    description: tag.description,
    operationCount: moduleOperations.length,
    readCount: moduleOperations.filter((operation) => operation.method === "get").length,
    writeCount: moduleOperations.filter((operation) => ["post", "put", "patch", "delete"].includes(operation.method)).length,
  };
});

export function moduleSlug(tag: string) {
  return tag.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
}

export function getModule(slug: string) {
  return modules.find((module) => module.slug === slug);
}

export function getOperation(id: string) {
  return operations.find((operation) => operation.id === id);
}

export function getModuleOperations(moduleName: string) {
  return operations.filter((operation) => operation.tag === moduleName);
}

export function groupName(tag: string) {
  const lower = tag.toLowerCase();
  if (lower.includes("trip") || lower.includes("dispatch") || lower.includes("linehaul") || lower.includes("loadmaster")) return "Fleet & dispatch";
  if (lower.includes("shipment") || lower.startsWith("order") || lower.includes("revenue") || lower.includes("pro-no")) return "Orders & shipment";
  if (lower.includes("task") || lower.includes("appointment") || lower.includes("openjob")) return "Tasks & appointments";
  return "Network & services";
}

export function resolveSchema(schema?: Schema, seen = new Set<string>(), depth = 0): Schema | undefined {
  if (!schema || depth > 5) return schema;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return { type: "object", description: "Recursive model" };
    const name = schema.$ref.split("/").at(-1);
    const target = name ? spec.components?.schemas?.[name] : undefined;
    if (!target) return schema;
    return resolveSchema(target, new Set([...seen, schema.$ref]), depth + 1);
  }
  if (schema.allOf) {
    const resolved = schema.allOf.map((entry) => resolveSchema(entry, seen, depth + 1) ?? {});
    return {
      ...schema,
      type: "object",
      properties: Object.assign({}, ...resolved.map((entry) => entry.properties ?? {}), schema.properties ?? {}),
      required: Array.from(new Set(resolved.flatMap((entry) => entry.required ?? []).concat(schema.required ?? []))),
      allOf: undefined,
    };
  }
  return {
    ...schema,
    properties: schema.properties
      ? Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, resolveSchema(value, seen, depth + 1) ?? value]))
      : undefined,
    items: schema.items ? resolveSchema(schema.items, seen, depth + 1) : undefined,
  };
}

export function requestBodySchema(operation: Operation) {
  const entries = Object.entries(operation.requestBody?.content ?? {});
  const preferred = entries.find(([type]) => type === "application/json") ?? entries[0];
  return preferred ? { contentType: preferred[0], schema: resolveSchema(preferred[1].schema), example: preferred[1].example } : undefined;
}

export function responseModels(operation: Operation) {
  return Object.entries(operation.responses ?? {}).map(([status, response]) => {
    const content = Object.entries(response.content ?? {})[0];
    return {
      status,
      description: response.description ?? "No description",
      contentType: content?.[0],
      schema: content ? resolveSchema(content[1].schema) : undefined,
    };
  });
}

export function firstDescription(value?: string) {
  return englishLine(value).replace(/\s+/g, " ");
}

export function securityFor(operation: Operation) {
  return operation.security ?? spec.security ?? [];
}
