export const HTTP_TIMEOUT = Number(process.env.HTTP_TIMEOUT) || 15000;
export const MAX_RESULTS = Number(process.env.MAX_RESULTS) || 10;
export const MAX_BYTES = Number(process.env.MAX_BYTES) || 20 * 1024 * 1024;
export const CACHE_TTL_MS = 60000;
export const USER_AGENT = process.env.USER_AGENT || "mcp-web-search/1.1";
export const USER_AGENT_BROWSER = `${USER_AGENT} (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36`;
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
