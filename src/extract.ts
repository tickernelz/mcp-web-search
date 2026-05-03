import type { FetchOptions, FetchResult, ResourceType } from "./fetch/types.js";
import { fetchCache, createCacheKey } from "./utils/cache.js";
import { fetchResource, type FetchTransport } from "./fetch/http.js";
import { extractHtmlResource } from "./fetch/extractors/html.js";
import { extractTextResource } from "./fetch/extractors/text.js";
import { extractPdfResource } from "./fetch/extractors/pdf.js";
import { extractMediaResource } from "./fetch/extractors/media.js";
import { extractWithSiteAdapter } from "./fetch/site-adapters/index.js";
import { saveDownloadedResource } from "./fetch/download.js";
import { assertSafeUrl } from "./fetch/security.js";

function isHtml(contentType: string, url: URL): boolean {
  const lower = contentType.toLowerCase();
  return lower.includes("text/html") || lower.includes("application/xhtml") || url.pathname === "/";
}

function isPdf(contentType: string, url: URL): boolean {
  const lower = contentType.toLowerCase();
  return lower.includes("application/pdf") || url.pathname.toLowerCase().endsWith(".pdf");
}

function isTextLike(contentType: string, url: URL): boolean {
  const lower = contentType.toLowerCase();
  const path = url.pathname.toLowerCase();
  return (
    lower.startsWith("text/") ||
    lower.includes("application/json") ||
    lower.includes("application/xml") ||
    lower.includes("+json") ||
    lower.includes("+xml") ||
    /\.(txt|md|json|xml|csv|yaml|yml|log)$/.test(path)
  );
}

function isMediaLike(contentType: string, url: URL): boolean {
  const lower = contentType.toLowerCase();
  const path = url.pathname.toLowerCase();
  return (
    lower.startsWith("image/") ||
    lower.startsWith("audio/") ||
    lower.startsWith("video/") ||
    /\.(png|jpe?g|gif|webp|bmp|tiff?|svg|mp3|wav|ogg|flac|m4a|mp4|webm|mov|mkv|avi|zip|tar|tgz|gz|bz2|7z)$/.test(
      path
    )
  );
}

function cacheKeyFor(url: string, options?: FetchOptions): string {
  return createCacheKey(
    "fetch-v2",
    url,
    options?.format || "markdown",
    options?.max_length ?? 25000,
    options?.start_index ?? 0,
    options?.engine || "auto",
    options?.include_links ? 1 : 0,
    options?.include_media ? 1 : 0,
    options?.include_comments === false ? 0 : 1,
    options?.comment_limit ?? 30,
    options?.comment_sort || "top",
    options?.max_depth ?? 2,
    options?.download ? 1 : 0,
    options?.download_dir || "",
    options?.download_ttl_seconds ?? "",
    options?.max_download_bytes ?? ""
  );
}

export type { FetchOptions, FetchResult };

export async function fetchAndExtract(
  url: string,
  options?: FetchOptions,
  transport?: FetchTransport
): Promise<FetchResult> {
  const parsedUrl = new URL(url);
  await assertSafeUrl(parsedUrl);

  const cacheKey = cacheKeyFor(parsedUrl.toString(), options);
  if (!options?.fresh) {
    const cached = fetchCache.get(cacheKey) as FetchResult | undefined;
    if (cached) return cached;
  }

  const siteResult = await extractWithSiteAdapter(parsedUrl, options, transport);
  if (siteResult) {
    fetchCache.set(cacheKey, siteResult);
    return siteResult;
  }

  const resource = await fetchResource(parsedUrl, options?.timeout_ms, transport, options);
  const finalUrl = new URL(resource.finalUrl);
  let result: FetchResult;

  if (isPdf(resource.contentType, finalUrl)) {
    result = await extractPdfResource({
      buffer: resource.buffer,
      url: parsedUrl.toString(),
      finalUrl: resource.finalUrl,
      contentType: resource.contentType,
      status: resource.response.status,
      byteLength: resource.byteLength,
      options
    });
  } else if (isHtml(resource.contentType, finalUrl)) {
    result = extractHtmlResource({
      html: resource.buffer.toString("utf8"),
      url: parsedUrl.toString(),
      finalUrl: resource.finalUrl,
      contentType: resource.contentType,
      status: resource.response.status,
      byteLength: resource.byteLength,
      options
    });
  } else if (isTextLike(resource.contentType, finalUrl)) {
    result = extractTextResource({
      rawText: resource.buffer.toString("utf8"),
      url: parsedUrl.toString(),
      finalUrl: resource.finalUrl,
      contentType: resource.contentType,
      status: resource.response.status,
      byteLength: resource.byteLength,
      options
    });
  } else if (isMediaLike(resource.contentType, finalUrl)) {
    result = extractMediaResource({
      url: parsedUrl.toString(),
      finalUrl: resource.finalUrl,
      contentType: resource.contentType,
      status: resource.response.status,
      byteLength: resource.byteLength,
      options
    });
  } else {
    result = extractMediaResource({
      url: parsedUrl.toString(),
      finalUrl: resource.finalUrl,
      contentType: resource.contentType,
      status: resource.response.status,
      byteLength: resource.byteLength,
      options
    });
    result.resource_type = "unknown" as ResourceType;
  }

  const attachment = await saveDownloadedResource({
    buffer: resource.buffer,
    finalUrl: resource.finalUrl,
    contentType: resource.contentType,
    contentDisposition: resource.response.headers.get("content-disposition"),
    resourceType: result.resource_type,
    options
  });
  if (attachment) result.attachments = [attachment];

  fetchCache.set(cacheKey, result);
  return result;
}
