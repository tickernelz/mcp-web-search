# MCP Web Search

[![npm version](https://img.shields.io/npm/v/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![npm downloads](https://img.shields.io/npm/dm/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![license](https://img.shields.io/npm/l/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)

MCP server: multi-provider web search plus a Fetch v2 URL/resource loader. No API keys required.

## Features

- **search_web** - Multi-provider web search with automatic fallback (DuckDuckGo, Bing, SearXNG)
- **fetch_url** - Universal URL/resource loader with normalized Fetch v2 output
- Fetch v2 supports HTML, PDF, text, Markdown, JSON/XML/CSV, media metadata, and site adapters
- Reddit thread URLs are extracted through Reddit JSON endpoints instead of brittle HTML scraping
- Pagination with `start_index` and `max_length` for long resources
- Optional link and media summaries for HTML pages
- Stronger URL safety checks for localhost, private IPs, link-local addresses, and redirects

## Breaking Changes in Fetch v2

`fetch_url` no longer returns top-level `markdown` or `text` fields. It now returns a single normalized envelope:

- `content` - extracted content string
- `format` - format of `content`, such as `markdown`, `text`, `json`, `html`, or `raw`
- `resource_type` - detected resource type, such as `html`, `pdf`, `text`, `json`, `image`, `site`, or `unknown`
- `metadata` - status, content type, byte length, extractor name, and extractor-specific fields
- `start_index` and `next_start_index` - pagination state
- `truncated` and `original_length` - truncation state
- `links` and `media` - optional summaries when requested

The old `mode` option was removed. Use `max_length` and `start_index` directly.

## Providers

| Provider | API Key Required | Description |
|----------|------------------|-------------|
| **DuckDuckGo** | No | HTML scraping, fast and simple |
| **Bing** | No | Puppeteer-based search (requires Chrome) |
| **SearXNG** | No | Self-hosted meta-search, unlimited usage |

## Requirements

- Node.js 18+
- Chrome/Chromium for the Bing provider

## MCP Configuration

### Claude Code

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "@zhafron/mcp-web-search"]
    }
  }
}
```

### OpenCode

```json
{
  "mcp": {
    "web-search": {
      "type": "local",
      "command": ["npx", "@zhafron/mcp-web-search"]
    }
  }
}
```

### With Custom Configuration

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "@zhafron/mcp-web-search"],
      "env": {
        "DEFAULT_SEARCH_PROVIDER": "duckduckgo",
        "SEARXNG_URL": "http://localhost:8099"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_SEARCH_PROVIDER` | `duckduckgo` | Default search provider (`duckduckgo`, `bing`, `searxng`) |
| `SEARXNG_URL` | `http://localhost:8099` | SearXNG instance URL |
| `HTTP_TIMEOUT` | `15000` | Request timeout in milliseconds |
| `MAX_BYTES` | `20971520` | Maximum downloaded response size |
| `MCP_COMPAT_MODE` | unset | Set to `legacy` to simplify `tools/list` schemas for MCP clients with weak discovery parsers |

### Legacy Discovery Compatibility

If your MCP client fails during discovery on array-valued JSON Schema nodes such as `enum` or `required`, set `MCP_COMPAT_MODE=legacy`.

This keeps tool execution unchanged, but advertises a simplified `tools/list` schema that removes array-valued schema nodes from tool metadata.

## Anti-Bot Detection

This package uses realistic rotating user agents for general HTTP requests:

- Random user agents from real browsers
- Desktop device category for consistency
- Different user agent per request

Site adapters may use site-appropriate descriptive user agents. For example, the Reddit adapter uses a descriptive MCP user agent for JSON endpoints.

## Chrome Setup for Bing Provider

| OS | Command |
|----|---------|
| Ubuntu/Debian | `sudo apt install chromium-browser` |
| Fedora | `sudo dnf install chromium` |
| Arch | `sudo pacman -S chromium` |
| macOS | `brew install --cask google-chrome` |

Custom path: `export CHROME_PATH=/path/to/chrome`

## Tools

### search_web

Input:

```json
{
  "q": "search query",
  "limit": 10,
  "lang": "en",
  "provider": "duckduckgo"
}
```

`provider` can be `duckduckgo`, `bing`, or `searxng`.

Output:

```json
{
  "items": [
    { "title": "...", "url": "https://example.com", "snippet": "...", "source": "duckduckgo" }
  ],
  "providerUsed": "duckduckgo",
  "fallbackUsed": false,
  "triedProviders": ["duckduckgo"]
}
```

Automatic fallback order is based on the selected provider:

- DuckDuckGo → SearXNG → Bing
- SearXNG → DuckDuckGo → Bing
- Bing → DuckDuckGo → SearXNG

### fetch_url

Input:

```json
{
  "url": "https://example.com/article",
  "format": "markdown",
  "max_length": 8000,
  "start_index": 0,
  "include_links": true,
  "include_media": true
}
```

Supported options:

| Option | Description |
|--------|-------------|
| `url` | URL to fetch |
| `format` | `markdown`, `text`, `html`, `json`, `raw`, or `metadata` |
| `max_length` | Maximum returned content characters, default 25000 |
| `start_index` | Start content from this character index |
| `engine` | `auto`, `http`, or `browser`; browser is reserved for future optional fallback |
| `include_links` | Include extracted links for HTML pages |
| `include_media` | Include extracted image/video/audio references for HTML pages |
| `include_comments` | Include comments for site adapters that support comments, default true for Reddit |
| `comment_limit` | Maximum comments for comment-capable adapters, max 100 |
| `comment_sort` | `top`, `best`, `new`, or `controversial` |
| `max_depth` | Maximum comment nesting depth |
| `timeout_ms` | Request timeout override |
| `fresh` | Bypass in-memory cache |

Output shape:

```json
{
  "url": "https://example.com/article",
  "final_url": "https://example.com/article",
  "title": "Example Article",
  "content_type": "text/html",
  "resource_type": "html",
  "format": "markdown",
  "content": "# Example Article\n\n...",
  "metadata": {
    "status": 200,
    "content_type": "text/html",
    "byte_length": 12345,
    "extractor": "html",
    "fetched_at": "2026-05-03T00:00:00.000Z"
  },
  "truncated": false,
  "original_length": 1200,
  "start_index": 0,
  "next_start_index": null,
  "warnings": []
}
```

### Reddit Thread Extraction

Reddit thread URLs are handled by a site adapter and fetched through Reddit JSON endpoints.

Input example:

```json
{
  "url": "https://www.reddit.com/r/codex/comments/abc123/gpt55_is_so_good/",
  "include_comments": true,
  "comment_limit": 30,
  "comment_sort": "top",
  "max_depth": 2
}
```

The output uses `resource_type: "site"` and `metadata.extractor: "reddit-thread"`.

## SearXNG Setup

SearXNG is a free self-hosted meta-search engine. Quick setup with Docker:

```bash
mkdir -p ~/docker/searxng
```

Create `~/docker/searxng/settings.yml` with JSON enabled, then run the SearXNG container. The important setting is `search.formats` containing both `html` and `json`.

## SSRF Protection

`fetch_url` blocks:

- localhost hostnames
- `.localhost` and `.local` hostnames
- private IPv4 ranges
- loopback and link-local addresses
- IPv6 loopback, unspecified, unique-local, and link-local addresses
- redirects that resolve to blocked addresses

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chrome not found | Install Chrome/Chromium or set `CHROME_PATH` |
| SearXNG 403 | Enable JSON API in `settings.yml` |
| Timeout | Increase `HTTP_TIMEOUT` or pass `timeout_ms` |
| MCP discovery error: `'list' object has no attribute 'get'` | Set `MCP_COMPAT_MODE=legacy` |
| Reddit 429 | Reddit rate limited the JSON endpoint; retry later or lower frequency |

## License

MIT
