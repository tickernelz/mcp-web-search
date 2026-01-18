import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { extractWithReadabilityAlt } from "./extractors/readability-alt.js";
import { htmlToMarkdown } from "./extractors/markdown.js";

function uaHeaders() {
  const ua = process.env.USER_AGENT || "mcp-web-search/1.0";
  const lang = process.env.LANG_DEFAULT || "en";
  const accept = lang === "en" ? "en-US,en;q=0.9" : `${lang};q=0.9,en;q=0.8`;
  return { "User-Agent": ua, "Accept-Language": accept } as Record<string, string>;
}

function toMs(env: string | undefined, def: number) {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : def;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

const HTTP_TIMEOUT = toMs(process.env.HTTP_TIMEOUT, 15000);
const MAX_BYTES = toMs(process.env.MAX_BYTES, 20 * 1024 * 1024);

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

export async function fetchAndExtract(url: string): Promise<ExtractedDoc> {
  const u = new URL(url);
  if (isBlockedHost(u.hostname)) {
    throw new Error("Blocked localhost/private URL");
  }

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

  if (ct.includes("application/pdf") || u.pathname.toLowerCase().endsWith(".pdf")) {
    const pdfParse: any = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    const text = data.text || "";
    return {
      text,
      url,
      title: data.info?.Title,
      length: data.numpages,
      format: "text"
    };
  }

  const html = buf.toString("utf8");

  const extracted = extractWithReadabilityAlt(html, url);

  if (extracted && extracted.textContent && extracted.textContent.length > 0) {
    const markdown = htmlToMarkdown(extracted.content);

    if (markdown) {
      return {
        title: extracted.title || undefined,
        markdown,
        url,
        length: extracted.length,
        format: "markdown"
      };
    }

    return {
      title: extracted.title || undefined,
      text: extracted.textContent,
      url,
      length: extracted.length,
      format: "text"
    };
  }

  const fallback = fallbackExtraction(html, url);

  return {
    title: fallback.title,
    byline: fallback.byline,
    siteName: fallback.siteName,
    text: fallback.text,
    url,
    format: "text"
  };
}
