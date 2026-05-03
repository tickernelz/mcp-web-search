import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { htmlToMarkdown } from "../../extractors/markdown.js";
import { extractWithReadabilityAlt } from "../../extractors/readability-alt.js";
import type { FetchLink, FetchMedia, FetchOptions, FetchResult } from "../../extractors/types.js";
import { buildFetchResult } from "../result.js";

function textOf(element: Element | null): string | undefined {
  const value = element?.getAttribute("content") || element?.textContent || "";
  return value.trim() || undefined;
}

function attr(element: Element | null, name: string): string | undefined {
  const value = element?.getAttribute(name) || "";
  return value.trim() || undefined;
}

function absoluteUrl(value: string | null | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function sameHost(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

function extractLinks(doc: Document, baseUrl: string): FetchLink[] {
  const links: FetchLink[] = [];
  for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
    const url = absoluteUrl(anchor.getAttribute("href"), baseUrl);
    if (!url) continue;
    links.push({
      url,
      text: anchor.textContent?.trim() || undefined,
      title: attr(anchor, "title"),
      rel: attr(anchor, "rel"),
      internal: sameHost(url, baseUrl)
    });
  }
  return links;
}

function extractMedia(doc: Document, baseUrl: string): FetchMedia {
  const images = Array.from(doc.querySelectorAll("img[src]"))
    .map(img => {
      const url = absoluteUrl(img.getAttribute("src"), baseUrl);
      if (!url) return null;
      const width = Number(img.getAttribute("width") || "0") || undefined;
      const height = Number(img.getAttribute("height") || "0") || undefined;
      return {
        url,
        alt: attr(img, "alt"),
        title: attr(img, "title"),
        width,
        height
      };
    })
    .filter((image): image is NonNullable<typeof image> => Boolean(image));

  const videos = Array.from(doc.querySelectorAll("video[src], video source[src], iframe[src]"))
    .map(el => {
      const url = absoluteUrl(el.getAttribute("src"), baseUrl);
      if (!url) return null;
      return { url, title: attr(el, "title") };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const audio = Array.from(doc.querySelectorAll("audio[src], audio source[src]"))
    .map(el => {
      const url = absoluteUrl(el.getAttribute("src"), baseUrl);
      if (!url) return null;
      return { url, title: attr(el, "title") };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return { images, videos, audio };
}

function fallbackText(doc: Document): string {
  return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
}

export function extractHtmlResource(args: {
  html: string;
  url: string;
  finalUrl: string;
  contentType: string;
  status: number;
  byteLength: number;
  options?: FetchOptions;
}): FetchResult {
  const dom = new JSDOM(args.html, { url: args.finalUrl });
  const doc = dom.window.document;
  const title = doc.title || undefined;
  const description = textOf(doc.querySelector("meta[name='description']"));
  const canonical = absoluteUrl(
    attr(doc.querySelector("link[rel='canonical']"), "href"),
    args.finalUrl
  );
  const siteName = textOf(doc.querySelector("meta[property='og:site_name']"));
  const language = doc.documentElement.lang || undefined;

  const extracted = extractWithReadabilityAlt(args.html, args.finalUrl);
  const requestedFormat = args.options?.format || "markdown";
  const markdown = extracted?.content ? htmlToMarkdown(extracted.content) : null;
  const textContent = extracted?.textContent || fallbackText(doc);
  const htmlContent = extracted?.content || doc.body?.innerHTML || args.html;

  let format = requestedFormat;
  let content = "";
  if (requestedFormat === "html") {
    content = htmlContent;
  } else if (requestedFormat === "text") {
    content = textContent;
  } else if (requestedFormat === "raw") {
    content = args.html;
  } else if (requestedFormat === "metadata") {
    format = "json";
    content = JSON.stringify(
      { title, description, canonical_url: canonical, site_name: siteName },
      null,
      2
    );
  } else {
    format = "markdown";
    content = markdown || textContent;
  }

  return buildFetchResult({
    url: args.url,
    final_url: args.finalUrl,
    title: extracted?.title || title,
    content_type: args.contentType,
    resource_type: "html",
    format,
    content,
    metadata: {
      status: args.status,
      content_type: args.contentType,
      byte_length: args.byteLength,
      extractor: "html",
      description,
      canonical_url: canonical,
      site_name: siteName,
      language
    },
    links: args.options?.include_links ? extractLinks(doc, args.finalUrl) : undefined,
    media: args.options?.include_media ? extractMedia(doc, args.finalUrl) : undefined,
    options: args.options
  });
}
