import type { ProviderInterface, SearchItem, ProviderName } from "../types/provider.js";
import { PUPPETEER_TIMEOUT } from "../constants.js";
import { browserPool } from "../utils/browser-pool.js";
import { getRandomUserAgent, getAcceptLanguageHeader } from "../utils/user-agent.js";
import { searchCache, createCacheKey } from "../utils/cache.js";

export class BingProvider implements ProviderInterface {
  name: ProviderName = "bing";

  async search(q: string, limit: number, lang: string): Promise<SearchItem[]> {
    const cacheKey = createCacheKey("bing", q, limit, lang);
    const cached = searchCache.get(cacheKey) as SearchItem[] | undefined;
    if (cached) return cached;

    const userAgent = getRandomUserAgent();
    const results = await browserPool.withBrowser(async browser => {
      const page = await browser.newPage();
      try {
        await page.setUserAgent(userAgent);
        await page.setExtraHTTPHeaders(getAcceptLanguageHeader(lang));

        const url = new URL("https://www.bing.com/search");
        url.searchParams.set("q", q);
        if (lang) url.searchParams.set("setlang", lang);

        await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: PUPPETEER_TIMEOUT
        });

        const items = await page.evaluate(maxResults => {
          const results: Array<{ title: string; url: string; snippet?: string }> = [];
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
              results.push({ title, url: href, snippet: snippet || undefined });
            } catch {}

            if (results.length >= maxResults) break;
          }

          return results;
        }, limit);

        return items.map(r => ({ ...r, source: "bing" as string }));
      } finally {
        await page.close();
      }
    });

    searchCache.set(cacheKey, results);
    return results;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await browserPool.getBrowser();
      return true;
    } catch {
      return false;
    }
  }
}
