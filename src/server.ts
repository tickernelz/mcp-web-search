#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { providerRegistry, type ProviderName } from "./providers/index.js";
import { fetchAndExtract } from "./extract.js";
import { MAX_RESULTS } from "./constants.js";
import { toInt } from "./utils/http.js";
import { installLegacyToolsListCompat } from "./compat.js";

const DEFAULT_LIMIT = toInt(process.env.MAX_RESULTS, MAX_RESULTS);
const server = new McpServer({ name: "mcp-web-search", version: "1.3.0" });

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
      "Fetches a URL-like resource and returns a normalized Fetch v2 envelope. Supports HTML, PDF, text/data, media metadata, site adapters such as Reddit threads, pagination via start_index, and optional link/media/comment extraction.",
    inputSchema: {
      url: z.string().url(),
      format: z.enum(["markdown", "text", "html", "json", "raw", "metadata"]).optional(),
      max_length: z.number().int().min(0).max(100000).optional(),
      start_index: z.number().int().min(0).optional(),
      engine: z.enum(["auto", "http", "browser"]).optional(),
      include_links: z.boolean().optional(),
      include_media: z.boolean().optional(),
      include_metadata: z.boolean().optional(),
      include_comments: z.boolean().optional(),
      comment_limit: z.number().int().min(0).max(100).optional(),
      comment_sort: z.enum(["top", "best", "new", "controversial"]).optional(),
      max_depth: z.number().int().min(0).max(8).optional(),
      timeout_ms: z.number().int().min(1000).max(120000).optional(),
      fresh: z.boolean().optional(),
      download: z.boolean().optional(),
      download_dir: z.string().optional(),
      download_ttl_seconds: z.number().int().min(60).max(604800).optional(),
      max_download_bytes: z.number().int().min(1).max(26214400).optional()
    }
  },
  async ({
    url,
    format,
    max_length,
    start_index,
    engine,
    include_links,
    include_media,
    include_metadata,
    include_comments,
    comment_limit,
    comment_sort,
    max_depth,
    timeout_ms,
    fresh,
    download,
    download_dir,
    download_ttl_seconds,
    max_download_bytes
  }) => {
    const doc = await fetchAndExtract(url, {
      format,
      max_length,
      start_index,
      engine,
      include_links,
      include_media,
      include_metadata,
      include_comments,
      comment_limit,
      comment_sort,
      max_depth,
      timeout_ms,
      fresh,
      download,
      download_dir,
      download_ttl_seconds,
      max_download_bytes
    });
    return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
  }
);

installLegacyToolsListCompat(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-web-search ready (stdio)...");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
