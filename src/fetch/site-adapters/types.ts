import type { FetchOptions, FetchResult } from "../types.js";
import type { FetchTransport } from "../http.js";

export interface SiteAdapter {
  name: string;
  canHandle(url: URL): boolean;
  extract(url: URL, options?: FetchOptions, transport?: FetchTransport): Promise<FetchResult>;
}
