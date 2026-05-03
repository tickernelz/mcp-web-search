import type { FetchOptions, FetchResult } from "../../extractors/types.js";
import { buildFetchResult } from "../result.js";

export async function extractPdfResource(args: {
  buffer: Buffer;
  url: string;
  finalUrl: string;
  contentType: string;
  status: number;
  byteLength: number;
  options?: FetchOptions;
}): Promise<FetchResult> {
  const pdfParse: any = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(args.buffer);
  const text = data.text || "";
  const format = args.options?.format === "metadata" ? "json" : "text";
  const content =
    args.options?.format === "metadata"
      ? JSON.stringify({ pages: data.numpages, info: data.info || {} }, null, 2)
      : text;

  return buildFetchResult({
    url: args.url,
    final_url: args.finalUrl,
    title: data.info?.Title,
    content_type: args.contentType,
    resource_type: "pdf",
    format,
    content,
    metadata: {
      status: args.status,
      content_type: args.contentType,
      byte_length: args.byteLength,
      extractor: "pdf",
      pages: data.numpages,
      info: data.info || {}
    },
    options: args.options
  });
}
