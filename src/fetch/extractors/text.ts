import type {
  FetchFormat,
  FetchOptions,
  FetchResult,
  ResourceType
} from "../../extractors/types.js";
import { buildFetchResult } from "../result.js";

function typeFromContentType(contentType: string, url: string): ResourceType {
  const lower = contentType.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();
  if (lower.includes("application/json") || path.endsWith(".json")) return "json";
  if (lower.includes("xml") || path.endsWith(".xml")) return "xml";
  if (lower.includes("csv") || path.endsWith(".csv")) return "csv";
  return "text";
}

function defaultFormat(resourceType: ResourceType, requested?: FetchFormat): FetchFormat {
  if (requested === "json" && resourceType === "json") return "json";
  if (requested === "raw") return "raw";
  if (requested === "metadata") return "json";
  if (resourceType === "json") return "json";
  return "text";
}

function renderContent(raw: string, resourceType: ResourceType, format: FetchFormat): string {
  if (format === "json" && resourceType === "json") {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function extractTextResource(args: {
  rawText: string;
  url: string;
  finalUrl: string;
  contentType: string;
  status: number;
  byteLength: number;
  options?: FetchOptions;
}): FetchResult {
  const resourceType = typeFromContentType(args.contentType, args.finalUrl);
  const format = defaultFormat(resourceType, args.options?.format);
  return buildFetchResult({
    url: args.url,
    final_url: args.finalUrl,
    title: new URL(args.finalUrl).pathname.split("/").pop() || undefined,
    content_type: args.contentType,
    resource_type: resourceType,
    format: format === "metadata" ? "json" : format,
    content:
      format === "metadata"
        ? JSON.stringify({ content_type: args.contentType, byte_length: args.byteLength }, null, 2)
        : renderContent(args.rawText, resourceType, format),
    metadata: {
      status: args.status,
      content_type: args.contentType,
      byte_length: args.byteLength,
      extractor: resourceType
    },
    options: args.options
  });
}
