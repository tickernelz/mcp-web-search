import type { ProviderInterface, SearchItem, ProviderName } from "../types/provider.js";
import { HTTP_TIMEOUT, SEARXNG_URL } from "../constants.js";
import { fetchWithTimeout } from "../utils/http.js";
import { searchCache, createCacheKey } from "../utils/cache.js";

export class SearXNGProvider implements ProviderInterface {
  name: ProviderName = "searxng";
  private instanceUrl: string;

  constructor(instanceUrl?: string) {
    this.instanceUrl = instanceUrl || SEARXNG_URL;
  }

  async search(q: string, limit: number, lang: string): Promise<SearchItem[]> {
    const cacheKey = createCacheKey("searxng", q, limit, lang);
    const cached = searchCache.get(cacheKey) as SearchItem[] | undefined;
    if (cached) return cached;

    const params = new URLSearchParams({
      q: q,
      format: "json",
      language: lang,
      safesearch: "0"
    });

    const url = `${this.instanceUrl}/search?${params.toString()}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "mcp-web-search/1.1",
          Accept: "application/json"
        }
      },
      HTTP_TIMEOUT
    );

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error(
          "SearXNG JSON API disabled. Enable 'json' in search.formats in settings.yml"
        );
      }
      throw new Error(`SearXNG error: ${res.status}`);
    }

    const data = await res.json();
    const items: SearchItem[] = (data.results || []).slice(0, limit).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || undefined,
      source: "searxng"
    }));

    searchCache.set(cacheKey, items);
    return items;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(
        `${this.instanceUrl}/search?q=test&format=json`,
        { headers: { Accept: "application/json" } },
        5000
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
