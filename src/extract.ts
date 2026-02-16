import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { extractWithReadabilityAlt } from "./extractors/readability-alt.js";
import { htmlToMarkdown } from "./extractors/markdown.js";
import { applySmartTruncation } from "./extractors/truncation.js";
import type { ExtractionOptions } from "./extractors/types.js";
import { HTTP_TIMEOUT, MAX_BYTES } from "./constants.js";
import { fetchWithTimeout, uaHeaders, toInt } from "./utils/http.js";
import { fetchCache, createCacheKey } from "./utils/cache.js";

export interface ExtractedDoc {
  title?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
  text?: string;
  markdown?: string;
  url: string;
  length?: number;
  format: "markdown" | "text";
  truncated?: boolean;
  original_length?: number;
  truncation_ratio?: number;
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower.endsWith(".local") || lower.endsWith(".localhost")) return true;
  return false;
}

function fallbackExtraction(
  html: string,
  url: string
): { text: string; title?: string; byline?: string; siteName?: string } {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article) {
      return {
        title: article.title ?? undefined,
        byline: (article as any).byline ?? undefined,
        siteName: (article as any).siteName ?? undefined,
        text: (article as any).textContent ?? ""
      };
    }

    const text = dom.window.document.body.textContent || "";
    return { text, title: dom.window.document.title };
  } catch {
    return { text: "" };
  }
}

export async function fetchAndExtract(
  url: string,
  options?: ExtractionOptions
): Promise<ExtractedDoc> {
  const u = new URL(url);
  if (isBlockedHost(u.hostname)) {
    throw new Error("Blocked localhost/private URL");
  }

  const cacheKey = createCacheKey(
    "fetch",
    url,
    options?.mode || "standard",
    options?.format || "markdown"
  );
  const cached = fetchCache.get(cacheKey) as ExtractedDoc | undefined;
  if (cached) return cached;

  const res = await fetchWithTimeout(
    u.toString(),
    { redirect: "follow", headers: uaHeaders() },
    HTTP_TIMEOUT
  );
  if (!res.ok) throw new Error(`Fetch ${res.status} for ${url}`);

  const lenHeader = res.headers.get("content-length");
  const len = Number(lenHeader || "0");
  if (len > 0 && len > MAX_BYTES) throw new Error(`Content too large: ${len} bytes`);

  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`Content too large (downloaded)`);

  if (
    ct.includes("text/plain") ||
    ct.includes("text/markdown") ||
    u.pathname.toLowerCase().endsWith(".md")
  ) {
    const rawText = buf.toString("utf8");
    const truncationResult = applySmartTruncation(rawText, "markdown", options);
    const result: ExtractedDoc = {
      text: truncationResult.content,
      markdown: truncationResult.content,
      url,
      title: u.pathname.split("/").pop(),
      format: "markdown",
      truncated: truncationResult.truncated,
      original_length: truncationResult.original_length,
      truncation_ratio: truncationResult.truncated
        ? truncationResult.final_length / truncationResult.original_length
        : undefined
    };
    fetchCache.set(cacheKey, result);
    return result;
  }

  if (ct.includes("application/pdf") || u.pathname.toLowerCase().endsWith(".pdf")) {
    const pdfParse: any = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    const text = data.text || "";
    const truncationResult = applySmartTruncation(text, "text", options);
    const result: ExtractedDoc = {
      text: truncationResult.content,
      url,
      title: data.info?.Title,
      length: data.numpages,
      format: "text",
      truncated: truncationResult.truncated,
      original_length: truncationResult.original_length,
      truncation_ratio: truncationResult.truncated
        ? truncationResult.final_length / truncationResult.original_length
        : undefined
    };
    fetchCache.set(cacheKey, result);
    return result;
  }

  const html = buf.toString("utf8");

  const extracted = extractWithReadabilityAlt(html, url);

  const requestedFormat = options?.format || "markdown";
  const shouldReturnMarkdown = requestedFormat === "markdown";
  const shouldReturnText = requestedFormat === "text";
  const shouldReturnHtml = requestedFormat === "html";

  if (extracted && extracted.textContent && extracted.textContent.length > 0) {
    const markdown = htmlToMarkdown(extracted.content);

    if (shouldReturnMarkdown && markdown) {
      const truncationResult = applySmartTruncation(markdown, "markdown", options);
      const result: ExtractedDoc = {
        title: extracted.title || undefined,
        markdown: truncationResult.content,
        url,
        length: extracted.length,
        format: "markdown",
        truncated: truncationResult.truncated,
        original_length: truncationResult.original_length,
        truncation_ratio: truncationResult.truncated
          ? truncationResult.final_length / truncationResult.original_length
          : undefined
      };
      fetchCache.set(cacheKey, result);
      return result;
    }

    if (shouldReturnText) {
      const truncationResult = applySmartTruncation(extracted.textContent, "text", options);
      const result: ExtractedDoc = {
        title: extracted.title || undefined,
        text: truncationResult.content,
        url,
        length: extracted.length,
        format: "text",
        truncated: truncationResult.truncated,
        original_length: truncationResult.original_length,
        truncation_ratio: truncationResult.truncated
          ? truncationResult.final_length / truncationResult.original_length
          : undefined
      };
      fetchCache.set(cacheKey, result);
      return result;
    }

    if (shouldReturnHtml && extracted.content) {
      const truncationResult = applySmartTruncation(extracted.content, "markdown", options);
      const result: ExtractedDoc = {
        title: extracted.title || undefined,
        markdown: truncationResult.content,
        url,
        length: extracted.length,
        format: "markdown",
        truncated: truncationResult.truncated,
        original_length: truncationResult.original_length,
        truncation_ratio: truncationResult.truncated
          ? truncationResult.final_length / truncationResult.original_length
          : undefined
      };
      fetchCache.set(cacheKey, result);
      return result;
    }

    if (markdown) {
      const truncationResult = applySmartTruncation(markdown, "markdown", options);
      const result: ExtractedDoc = {
        title: extracted.title || undefined,
        markdown: truncationResult.content,
        url,
        length: extracted.length,
        format: "markdown",
        truncated: truncationResult.truncated,
        original_length: truncationResult.original_length,
        truncation_ratio: truncationResult.truncated
          ? truncationResult.final_length / truncationResult.original_length
          : undefined
      };
      fetchCache.set(cacheKey, result);
      return result;
    }

    const truncationResult = applySmartTruncation(extracted.textContent, "text", options);
    const result: ExtractedDoc = {
      title: extracted.title || undefined,
      text: truncationResult.content,
      url,
      length: extracted.length,
      format: "text",
      truncated: truncationResult.truncated,
      original_length: truncationResult.original_length,
      truncation_ratio: truncationResult.truncated
        ? truncationResult.final_length / truncationResult.original_length
        : undefined
    };
    fetchCache.set(cacheKey, result);
    return result;
  }

  const fallback = fallbackExtraction(html, url);
  const truncationResult = applySmartTruncation(fallback.text, "text", options);

  const result: ExtractedDoc = {
    title: fallback.title,
    byline: fallback.byline,
    siteName: fallback.siteName,
    text: truncationResult.content,
    url,
    format: "text",
    truncated: truncationResult.truncated,
    original_length: truncationResult.original_length,
    truncation_ratio: truncationResult.truncated
      ? truncationResult.final_length / truncationResult.original_length
      : undefined
  };
  fetchCache.set(cacheKey, result);
  return result;
}
