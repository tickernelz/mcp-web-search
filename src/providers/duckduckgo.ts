import { JSDOM } from "jsdom";
import type { ProviderInterface, SearchItem, ProviderName } from "../types/provider.js";
import { HTTP_TIMEOUT } from "../constants.js";
import { fetchWithTimeout } from "../utils/http.js";
import { getRandomUserAgent, getAcceptLanguageHeader } from "../utils/user-agent.js";
import { searchCache, createCacheKey } from "../utils/cache.js";

export class DuckDuckGoProvider implements ProviderInterface {
  name: ProviderName = "duckduckgo";

  private decodeDuckDuckGoRedirect(href: string): string {
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

  async search(q: string, limit: number, lang: string): Promise<SearchItem[]> {
    const cacheKey = createCacheKey("ddg", q, limit, lang);
    const cached = searchCache.get(cacheKey) as SearchItem[] | undefined;
    if (cached) return cached;

    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", q);
    const headers = {
      "User-Agent": getRandomUserAgent(),
      ...getAcceptLanguageHeader(lang)
    };
    const res = await fetchWithTimeout(url, { headers }, HTTP_TIMEOUT);
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
      const href = this.decodeDuckDuckGoRedirect(a.getAttribute("href") || "");
      if (!title || !href) continue;
      const sn = (snippets[i]?.textContent || "").trim() || undefined;
      try {
        const u = new URL(href);
        items.push({ title, url: u.toString(), snippet: sn, source: "duckduckgo" });
      } catch {}
    }
    searchCache.set(cacheKey, items);
    return items;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
