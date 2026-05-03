import type { FetchOptions, FetchResult, ResourceType } from "../types.js";
import { buildFetchResult } from "../result.js";

function mediaType(contentType: string, url: string): ResourceType {
  const lower = contentType.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();
  if (lower.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|tiff?|svg)$/.test(path))
    return "image";
  if (lower.startsWith("audio/") || /\.(mp3|wav|ogg|flac|m4a)$/.test(path)) return "audio";
  if (lower.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/.test(path)) return "video";
  if (/\.(zip|tar|tgz|gz|bz2|7z)$/.test(path)) return "archive";
  return "unknown";
}

export function extractMediaResource(args: {
  url: string;
  finalUrl: string;
  contentType: string;
  status: number;
  byteLength: number;
  options?: FetchOptions;
}): FetchResult {
  const resourceType = mediaType(args.contentType, args.finalUrl);
  const content = JSON.stringify(
    {
      url: args.finalUrl,
      resource_type: resourceType,
      content_type: args.contentType,
      byte_length: args.byteLength
    },
    null,
    2
  );

  return buildFetchResult({
    url: args.url,
    final_url: args.finalUrl,
    title: new URL(args.finalUrl).pathname.split("/").pop() || undefined,
    content_type: args.contentType,
    resource_type: resourceType,
    format: "json",
    content,
    metadata: {
      status: args.status,
      content_type: args.contentType,
      byte_length: args.byteLength,
      extractor: resourceType
    },
    warnings: [
      `${resourceType} content is returned as metadata only; deep extraction requires optional converters.`
    ],
    options: args.options
  });
}
