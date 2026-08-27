import { notFound } from "next/navigation";
import { OperationWorkbench } from "@/components/operation-workbench";
import { connectionStatus, credentialStatus } from "@/lib/connections";
import { firstDescription, getOperation, moduleSlug, requestBodySchema, resolveSchema, responseModels } from "@/lib/openapi";

export default async function OperationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const operation = getOperation(id);
  if (!operation) notFound();

  const body = requestBodySchema(operation.operation);
  return <OperationWorkbench
    operation={{
      id: operation.id,
      label: operation.label,
      method: operation.method,
      path: operation.path,
      tag: operation.tag,
      moduleSlug: moduleSlug(operation.tag),
      description: firstDescription(operation.operation.description || operation.operation.summary),
      deprecated: operation.operation.deprecated,
      parameters: operation.parameters.map((parameter) => ({ ...parameter, schema: resolveSchema(parameter.schema) })),
      body: body ? { ...body, required: operation.operation.requestBody?.required, description: firstDescription(operation.operation.requestBody?.description) } : undefined,
      responses: responseModels(operation.operation),
    }}
    connection={connectionStatus(operation.tag)}
    credential={credentialStatus(operation)}
    allowBrowserOverrides={process.env.NODE_ENV !== "production"}
  />;
}
