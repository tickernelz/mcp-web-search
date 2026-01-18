#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runTwoTierSearch, type EngineName } from "./engines.js";
import { fetchAndExtract } from "./extract.js";

const toInt = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};
const DEFAULT_LIMIT = toInt(process.env.MAX_RESULTS, 10);
const server = new McpServer({ name: "mcp-web-search", version: "1.0.0" });

server.registerTool(
  "search_web",
  {
    title: "Web Search (Fast: DuckDuckGo, Deep: Puppeteer/Bing)",
    description:
      "Two-tier web search: runs fast DuckDuckGo HTML search by default, escalates to Puppeteer/Bing if results are insufficient. No API keys required.",
    inputSchema: {
      q: z.string(),
      limit: z.number().int().min(1).max(50).default(DEFAULT_LIMIT).optional(),
      lang: z.string().default("en").optional(),
      mode: z.enum(["fast", "deep", "auto"]).default("auto").optional()
    }
  },
  async ({ q, limit = DEFAULT_LIMIT, lang = "en", mode = "auto" }) => {
    const res = await runTwoTierSearch({ q, limit: Math.min(Math.max(1, limit), 50), lang, mode });
    const payload = { ...res, items: res.items.slice(0, limit) };
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  }
);

server.registerTool(
  "fetch_url",
  {
    title: "Fetch and Extract URL Content",
    description:
      "Fetches content from a URL (HTML/PDF) and extracts readable text. Supports truncation modes: compact (~3000 chars), standard (~8000 chars, default), full (no truncation). Output formats: markdown (default), text, html.",
    inputSchema: {
      url: z.string().url(),
      mode: z.enum(["compact", "standard", "full"]).optional(),
      max_length: z.number().int().min(1000).max(100000).optional(),
      format: z.enum(["markdown", "text", "html"]).optional()
    }
  },
  async ({ url, mode, max_length, format }) => {
    const doc = await fetchAndExtract(url, { mode, max_length, format });
    return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
  }
);

server.registerTool(
  "summarize_url",
  {
    title: "Summarize URL Content",
    description: "Fetches content from a URL and generates a concise summary.",
    inputSchema: { url: z.string().url() }
  },
  async ({ url }) => {
    const doc = await fetchAndExtract(url);
    try {
      const content = doc.markdown || doc.text || "";
      const prompt = `Provide a concise summary (<=10 sentences) of the following content:\n\nTitle: ${doc.title || "(none)"}\nURL: ${doc.url}\n\n--- Content ---\n${content.slice(0, 12000)}`;
      const resp = await (server as any).server.createMessage({
        messages: [{ role: "user", content: { type: "text", text: prompt } }],
        maxTokens: 800
      });
      const text =
        resp.content && resp.content.type === "text"
          ? resp.content.text
          : "(unable to generate summary)";
      return { content: [{ type: "text", text }] };
    } catch {
      const fallback = (doc.markdown || doc.text || "").slice(0, 2000);
      return { content: [{ type: "text", text: fallback || "(no content to summarize)" }] };
    }
  }
);

server.registerTool(
  "wiki_get",
  {
    title: "Wikipedia: Get Summary",
    description:
      "Retrieves a Wikipedia summary for a given title. Supports multiple languages (default: en).",
    inputSchema: { title: z.string(), lang: z.string().default("en").optional() }
  },
  async ({ title, lang = "en" }) => {
    const { wikiGetSummary } = await import("./wikipedia.js");
    const summary = await wikiGetSummary(title, lang);
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.registerTool(
  "wiki_multi",
  {
    title: "Wikipedia: Multi-Language Summary",
    description:
      "Retrieves Wikipedia summaries in multiple languages for a given term. Uses langlinks to map titles accurately across languages.",
    inputSchema: {
      term: z.string(),
      baseLang: z.string().default("en").optional(),
      langs: z.array(z.string()).default(["en"]).optional()
    }
  },
  async ({ term, baseLang = "en", langs = ["en"] }) => {
    const { wikiGetMultiSummary } = await import("./wikipedia.js");
    const out = await wikiGetMultiSummary(term, baseLang, langs);
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-web-search ready (stdio)...");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
