import { JSDOM } from "jsdom";
import puppeteer from "puppeteer-core";
import { findChrome } from "./chrome.js";

export type SearchMode = "fast" | "deep" | "auto";
export type EngineName = "ddg_html" | "bing_puppeteer";

export interface SearchItem {
  title: string;
  url: string;
  snippet?: string;
  source: EngineName;
}

export interface SearchResponse {
  items: SearchItem[];
  modeUsed: SearchMode;
  enginesUsed: EngineName[];
  escalated: boolean;
  diagnostics?: Record<string, unknown>;
}

function uaHeaders(lang = process.env.LANG_DEFAULT || "en") {
  const ua = process.env.USER_AGENT || "mcp-web-search/1.0";
  const acceptLang = lang === "en" ? "en-US,en;q=0.9" : `${lang};q=0.9,en;q=0.8`;
  return { "User-Agent": ua, "Accept-Language": acceptLang } as Record<string, string>;
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

function decodeDuckDuckGoRedirect(href: string): string {
  try {
    const u = new URL(href, "https://duckduckgo.com/");
    if (u.hostname === "duckduckgo.com" && u.pathname.startsWith("/l/")) {
      const real = u.searchParams.get("uddg");
      if (real) return decodeURIComponent(real);
    }
    return u.toString();
  } catch {
    return href;
  }
}

async function ddgHtmlSearch(q: string, limit: number, lang: string): Promise<SearchItem[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", q);
  const res = await fetchWithTimeout(url, { headers: uaHeaders(lang) }, HTTP_TIMEOUT);
  if (!res.ok) throw new Error(`DuckDuckGo HTML ${res.status}`);
  const html = await res.text();
  const dom = new JSDOM(html, { url: "https://duckduckgo.com/?q=" + encodeURIComponent(q) });
  const doc = dom.window.document;
  const anchors = Array.from(doc.querySelectorAll("a.result__a"));
  const snippets = Array.from(doc.querySelectorAll(".result__snippet"));
  const items: SearchItem[] = [];
  for (let i = 0; i < anchors.length && items.length < limit; i++) {
    const a = anchors[i] as HTMLAnchorElement;
    const title = (a.textContent || "").trim();
    const href = decodeDuckDuckGoRedirect(a.getAttribute("href") || "");
    if (!title || !href) continue;
    const sn = (snippets[i]?.textContent || "").trim() || undefined;
    try {
      const u = new URL(href);
      items.push({ title, url: u.toString(), snippet: sn, source: "ddg_html" });
    } catch {}
  }
  return items;
}

async function bingPuppeteerSearch(q: string, limit: number, lang: string): Promise<SearchItem[]> {
  const chromePath = findChrome();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent((process.env.USER_AGENT || "mcp-web-search/1.0") + " Puppeteer");
    await page.setExtraHTTPHeaders({
      "Accept-Language": lang === "en" ? "en-US,en;q=0.9" : `${lang};q=0.9,en;q=0.8`
    });

    const url = new URL("https://www.bing.com/search");
    url.searchParams.set("q", q);
    if (lang) url.searchParams.set("setlang", lang);

    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });

    const results = await page.evaluate(maxResults => {
      const items: Array<{ title: string; url: string; snippet?: string }> = [];
      const cards = document.querySelectorAll("li.b_algo");

      for (const card of Array.from(cards)) {
        const anchor = card.querySelector("h2 a");
        if (!anchor) continue;

        const title = anchor.textContent?.trim() || "";
        const href = anchor.getAttribute("href");
        if (!href || !title) continue;

        let snippet = "";
        const captionP = card.querySelector("div.b_caption p");
        if (captionP) {
          snippet = captionP.textContent?.trim() || "";
        } else {
          const snippetDiv = card.querySelector("div.b_snippet");
          if (snippetDiv) {
            snippet = snippetDiv.textContent?.trim() || "";
          }
        }

        try {
          new URL(href);
          items.push({ title, url: href, snippet: snippet || undefined });
        } catch {}

        if (items.length >= maxResults) break;
      }

      return items;
    }, limit);

    return results.map(r => ({ ...r, source: "bing_puppeteer" as EngineName }));
  } finally {
    await browser.close();
  }
}

export async function runTwoTierSearch(opts: {
  q: string;
  limit?: number;
  lang?: string;
  mode?: SearchMode;
  timeoutMs?: number;
}): Promise<SearchResponse> {
  const { q } = opts;
  const limit = Math.max(
    1,
    Math.min(Number(opts.limit ?? (Number(process.env.MAX_RESULTS) || 10)), 50)
  );

  const lang = opts.lang ?? (process.env.LANG_DEFAULT || "en");
  const mode = opts.mode ?? "auto";

  const enginesUsed: EngineName[] = [];
  const diagnostics: Record<string, unknown> = {};

  if (mode === "fast") {
    const fast = await ddgHtmlSearch(q, limit, lang);
    enginesUsed.push("ddg_html");
    diagnostics["fastCount"] = fast.length;
    return { items: fast, modeUsed: "fast", enginesUsed, escalated: false, diagnostics };
  }

  if (mode === "deep") {
    const deep = await bingPuppeteerSearch(q, limit, lang);
    enginesUsed.push("bing_puppeteer");
    diagnostics["deepCount"] = deep.length;
    return { items: deep, modeUsed: "deep", enginesUsed, escalated: false, diagnostics };
  }

  const fast = await ddgHtmlSearch(q, limit, lang);
  enginesUsed.push("ddg_html");
  diagnostics["fastCount"] = fast.length;
  if (fast.length < Math.min(3, limit)) {
    const deep = await bingPuppeteerSearch(q, limit, lang);
    enginesUsed.push("bing_puppeteer");
    diagnostics["deepCount"] = deep.length;
    return {
      items: [...fast, ...deep].slice(0, limit),
      modeUsed: "auto",
      enginesUsed,
      escalated: true,
      diagnostics
    };
  }
  return { items: fast, modeUsed: "auto", enginesUsed, escalated: false, diagnostics };
}
