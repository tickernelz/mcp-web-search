import { ListToolsRequestSchema, type ListToolsResult, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { normalizeObjectSchema, type AnySchema, type ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const EMPTY_OBJECT_JSON_SCHEMA = {
  type: "object",
  properties: {}
};

const ARRAY_KEYWORDS = new Set([
  "allOf",
  "anyOf",
  "enum",
  "examples",
  "oneOf",
  "prefixItems",
  "required",
  "type"
]);

type JsonObject = Record<string, unknown>;

type RegisteredTool = {
  title?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: Tool["annotations"];
  execution?: Tool["execution"];
  _meta?: Record<string, unknown>;
  enabled: boolean;
};

function appendDescription(base: unknown, extra: string) {
  const current = typeof base === "string" && base.trim() ? base.trim() : "";
  return current ? `${current} ${extra}` : extra;
}

function sanitizeJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const input = value as JsonObject;
  const output: JsonObject = {};
  let description = input.description;

  for (const [key, rawValue] of Object.entries(input)) {
    if (rawValue === undefined) {
      continue;
    }

    if (ARRAY_KEYWORDS.has(key) && Array.isArray(rawValue)) {
      if (key === "enum" && rawValue.length > 0) {
        description = appendDescription(description, `Allowed values: ${rawValue.join(", ")}.`);
      }

      if (key === "required" && rawValue.length > 0) {
        description = appendDescription(description, `Required fields: ${rawValue.join(", ")}.`);
      }

      if (key === "type" && rawValue.length > 0) {
        description = appendDescription(description, `Accepted types: ${rawValue.join(", ")}.`);
      }

      continue;
    }

    if (key === "properties" && rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      const nextProperties: JsonObject = {};

      for (const [propertyName, propertySchema] of Object.entries(rawValue as JsonObject)) {
        const sanitizedProperty = sanitizeJsonSchema(propertySchema);
        if (sanitizedProperty !== undefined) {
          nextProperties[propertyName] = sanitizedProperty;
        }
      }

      output[key] = nextProperties;
      continue;
    }

    const sanitized = sanitizeJsonSchema(rawValue);
    if (sanitized !== undefined) {
      output[key] = sanitized;
    }
  }

  if (description !== undefined) {
    output.description = description;
  }

  return output;
}

function toToolSchema(schema: unknown, pipeStrategy: "input" | "output") {
  const objectSchema = normalizeObjectSchema(schema as AnySchema | ZodRawShapeCompat | undefined);
  if (!objectSchema) {
    return EMPTY_OBJECT_JSON_SCHEMA;
  }

  return toJsonSchemaCompat(objectSchema, {
    strictUnions: true,
    pipeStrategy
  });
}

function getRegisteredTools(server: McpServer) {
  return ((server as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools ?? {});
}

function buildCompatToolsList(server: McpServer): ListToolsResult {
  const registeredTools = getRegisteredTools(server);

  return {
    tools: Object.entries(registeredTools)
      .filter(([, tool]) => tool.enabled)
      .map(([name, tool]) => {
        const compatTool: Tool = {
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: sanitizeJsonSchema(toToolSchema(tool.inputSchema, "input")) as Tool["inputSchema"],
          annotations: tool.annotations,
          execution: tool.execution,
          _meta: tool._meta
        };

        if (tool.outputSchema) {
          compatTool.outputSchema = sanitizeJsonSchema(toToolSchema(tool.outputSchema, "output")) as Tool["outputSchema"];
        }

        return compatTool;
      })
  };
}

export function getCompatMode() {
  return process.env.MCP_COMPAT_MODE?.trim().toLowerCase() ?? "";
}

export function isLegacyCompatMode() {
  return getCompatMode() === "legacy";
}

export function installLegacyToolsListCompat(server: McpServer) {
  if (!isLegacyCompatMode()) {
    return;
  }

  server.server.setRequestHandler(ListToolsRequestSchema, () => buildCompatToolsList(server));
}
