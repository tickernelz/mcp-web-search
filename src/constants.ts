export const HTTP_TIMEOUT = Number(process.env.HTTP_TIMEOUT) || 15000;
export const MAX_RESULTS = Number(process.env.MAX_RESULTS) || 10;
export const MAX_BYTES = Number(process.env.MAX_BYTES) || 20 * 1024 * 1024;
export const CACHE_TTL_MS = 60000;
export const PUPPETEER_TIMEOUT = 30000;
export const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu"
];
export const DEFAULT_SEARCH_PROVIDER =
  (process.env.DEFAULT_SEARCH_PROVIDER as ProviderName) || "duckduckgo";
export const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8099";

import type { ProviderName } from "./types/provider.js";
