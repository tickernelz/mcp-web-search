#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { providerRegistry, type ProviderName } from "./providers/index.js";
import { fetchAndExtract } from "./extract.js";
import { MAX_RESULTS } from "./constants.js";
import { toInt } from "./utils/http.js";

const DEFAULT_LIMIT = toInt(process.env.MAX_RESULTS, MAX_RESULTS);
const server = new McpServer({ name: "mcp-web-search", version: "1.1.0" });

server.registerTool(
  "search_web",
  {
    title: "Web Search",
    description:
      "Search the web using multiple providers (DuckDuckGo, Bing, SearXNG). Automatically falls back to other providers if the default fails. No API keys required for DuckDuckGo and SearXNG.",
    inputSchema: {
      q: z.string(),
      limit: z.number().int().min(1).max(50).default(DEFAULT_LIMIT).optional(),
      lang: z.string().default("en").optional(),
      provider: z.enum(["duckduckgo", "bing", "searxng"]).optional()
    }
  },
  async ({ q, limit = DEFAULT_LIMIT, lang = "en", provider }) => {
    const res = await providerRegistry.searchWithFallback(
      q,
      Math.min(Math.max(1, limit), 50),
      lang,
      provider as ProviderName | undefined
    );
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-web-search ready (stdio)...");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
