export interface SearchItem {
  title: string;
  url: string;
  snippet?: string;
  source: string;
}

export interface ProviderInterface {
  name: string;
  search(q: string, limit: number, lang: string): Promise<SearchItem[]>;
  isAvailable(): Promise<boolean>;
}

export type ProviderName = "duckduckgo" | "bing" | "searxng";

export interface SearchResponse {
  items: SearchItem[];
  providerUsed: ProviderName;
  fallbackUsed: boolean;
  triedProviders: ProviderName[];
}
