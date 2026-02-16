import UserAgent from "user-agents";

const userAgentInstance = new UserAgent({ deviceCategory: "desktop" });

export function getRandomUserAgent(): string {
  return userAgentInstance.random().toString();
}

export function getAcceptLanguageHeader(lang = "en"): Record<string, string> {
  const acceptLang = lang === "en" ? "en-US,en;q=0.9" : `${lang};q=0.9,en;q=0.8`;
  return { "Accept-Language": acceptLang };
}

export function getRandomHeaders(lang = process.env.LANG_DEFAULT || "en"): Record<string, string> {
  return {
    "User-Agent": getRandomUserAgent(),
    ...getAcceptLanguageHeader(lang)
  };
}
