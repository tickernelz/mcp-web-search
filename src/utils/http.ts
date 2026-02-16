import { HTTP_TIMEOUT, USER_AGENT_BROWSER } from "../constants.js";

export function toInt(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export function toMs(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export function uaHeaders(lang = process.env.LANG_DEFAULT || "en"): Record<string, string> {
  const acceptLang = lang === "en" ? "en-US,en;q=0.9" : `${lang};q=0.9,en;q=0.8`;
  return { "User-Agent": USER_AGENT_BROWSER, "Accept-Language": acceptLang };
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = HTTP_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}
