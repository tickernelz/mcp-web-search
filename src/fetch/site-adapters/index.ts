import type { FetchOptions, FetchResult } from "../types.js";
import type { FetchTransport } from "../http.js";
import type { SiteAdapter } from "./types.js";
import { RedditThreadAdapter } from "./reddit.js";

const adapters: SiteAdapter[] = [new RedditThreadAdapter()];

export function findSiteAdapter(url: URL): SiteAdapter | undefined {
  return adapters.find(adapter => adapter.canHandle(url));
}

export async function extractWithSiteAdapter(
  url: URL,
  options?: FetchOptions,
  transport?: FetchTransport
): Promise<FetchResult | null> {
  const adapter = findSiteAdapter(url);
  if (!adapter) return null;
  return adapter.extract(url, options, transport);
}
