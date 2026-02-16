import type {
  ProviderInterface,
  ProviderName,
  SearchItem,
  SearchResponse
} from "../types/provider.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";
import { BingProvider } from "./bing.js";
import { SearXNGProvider } from "./searxng.js";
import { DEFAULT_SEARCH_PROVIDER } from "../constants.js";

const PROVIDER_FALLBACK_ORDER: Record<ProviderName, ProviderName[]> = {
  duckduckgo: ["duckduckgo", "searxng", "bing"],
  searxng: ["searxng", "duckduckgo", "bing"],
  bing: ["bing", "duckduckgo", "searxng"]
};

class ProviderRegistry {
  private providers: Map<ProviderName, ProviderInterface>;

  constructor() {
    this.providers = new Map();
    this.providers.set("duckduckgo", new DuckDuckGoProvider());
    this.providers.set("bing", new BingProvider());
    this.providers.set("searxng", new SearXNGProvider());
  }

  get(name: ProviderName): ProviderInterface | undefined {
    return this.providers.get(name);
  }

  async searchWithFallback(
    q: string,
    limit: number,
    lang: string,
    preferredProvider?: ProviderName
  ): Promise<SearchResponse> {
    const defaultProvider = preferredProvider || DEFAULT_SEARCH_PROVIDER;
    const fallbackOrder = PROVIDER_FALLBACK_ORDER[defaultProvider];
    const triedProviders: ProviderName[] = [];
    let lastError: Error | null = null;

    for (const providerName of fallbackOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      triedProviders.push(providerName);

      try {
        const items = await provider.search(q, limit, lang);
        if (items.length > 0) {
          return {
            items,
            providerUsed: providerName,
            fallbackUsed: providerName !== defaultProvider,
            triedProviders
          };
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    return {
      items: [],
      providerUsed: defaultProvider,
      fallbackUsed: true,
      triedProviders
    };
  }
}

export const providerRegistry = new ProviderRegistry();

export { DuckDuckGoProvider, BingProvider, SearXNGProvider };
