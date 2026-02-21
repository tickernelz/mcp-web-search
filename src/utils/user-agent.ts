import UserAgent from "user-agents";

const userAgentInstance = new UserAgent({ deviceCategory: "desktop" });

export function getRandomUserAgent(): string {
  return userAgentInstance.random().toString();
}

export function getAcceptLanguageHeader(lang = "en"): Record<string, string> {
  const acceptLang = lang === "en" ? "en-US,en;q=0.9" : `${lang};q=0.9,en;q=0.8`;
  return { "Accept-Language": acceptLang };
}

const MARKET_MAP: Record<string, string> = {
  en: "en-US",
  id: "id-ID",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-BR",
  ru: "ru-RU",
  ar: "ar-SA",
  th: "th-TH",
  vi: "vi-VN",
  ms: "ms-MY",
  nl: "nl-NL",
  it: "it-IT",
  pl: "pl-PL",
  tr: "tr-TR"
};

export function getMarketFromLang(lang: string): string {
  const normalized = lang.split("-")[0].toLowerCase();
  return MARKET_MAP[normalized] || "en-US";
}

export function getRandomHeaders(lang = process.env.LANG_DEFAULT || "en"): Record<string, string> {
  return {
    "User-Agent": getRandomUserAgent(),
    ...getAcceptLanguageHeader(lang)
  };
}
