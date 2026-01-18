import { JSDOM } from "jsdom";
import type { ExtractResult, ExtractConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

function scoreNode(node: Element, config: ExtractConfig): number {
  let score = 0;
  const text = node.textContent || "";
  const textLength = text.trim().length;

  if (textLength < config.minTextLength) return 0;

  score += textLength * 0.1;

  const tagName = node.tagName.toLowerCase();
  const boost = config.tagBoosts[tagName] || 1.0;
  score *= boost;

  const className = node.className || "";
  const id = node.id || "";
  if (config.ignoreClasses.test(className) || config.ignoreClasses.test(id)) {
    return 0;
  }

  const density = textLength / (node.children.length + 1);
  score += density * 0.5;

  const pCount = node.querySelectorAll("p").length;
  score += pCount * 5;

  return score;
}

function cleanNode(node: Element): void {
  const toRemove = ["script", "style", "noscript", "iframe", "object", "embed"];
  toRemove.forEach(tag => {
    node.querySelectorAll(tag).forEach(el => el.remove());
  });

  node.querySelectorAll("*").forEach(el => {
    const className = el.className || "";
    const id = el.id || "";
    if (/ads|advertisement|sponsor|promo/i.test(className) || /ads|advertisement/i.test(id)) {
      el.remove();
    }
  });
}

function extractTextContent(node: Element): string {
  let text = "";

  function traverse(el: Node): void {
    if (el.nodeType === 3) {
      const content = el.textContent?.trim();
      if (content) text += content + " ";
    } else if (el.nodeType === 1) {
      const element = el as Element;
      if (["P", "DIV", "BR", "H1", "H2", "H3", "H4", "H5", "H6"].includes(element.tagName)) {
        text += "\n";
      }
      element.childNodes.forEach(child => traverse(child));
    }
  }

  traverse(node);
  return text.replace(/\s+/g, " ").trim();
}

export function extractWithReadabilityAlt(
  html: string,
  url: string,
  config: ExtractConfig = DEFAULT_CONFIG
): ExtractResult | null {
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const title = doc.title || "";

    const candidates = Array.from(
      doc.querySelectorAll("article, section, main, div, [role='main']")
    );

    if (candidates.length === 0) {
      const body = doc.body;
      if (!body) return null;

      cleanNode(body);
      const textContent = extractTextContent(body);

      return {
        title,
        textContent,
        content: body.innerHTML,
        length: textContent.length
      };
    }

    let bestNode: Element | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = scoreNode(candidate, config);
      if (score > bestScore) {
        bestScore = score;
        bestNode = candidate;
      }
    }

    if (!bestNode || bestScore === 0) {
      const body = doc.body;
      if (!body) return null;

      cleanNode(body);
      const textContent = extractTextContent(body);

      return {
        title,
        textContent,
        content: body.innerHTML,
        length: textContent.length
      };
    }

    cleanNode(bestNode);
    const textContent = extractTextContent(bestNode);

    return {
      title,
      textContent,
      content: bestNode.innerHTML,
      length: textContent.length
    };
  } catch (error) {
    console.error("Content extraction failed:", error);
    return null;
  }
}
