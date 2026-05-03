# MCP Web Search

[![npm version](https://img.shields.io/npm/v/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![npm downloads](https://img.shields.io/npm/dm/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![license](https://img.shields.io/npm/l/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)

MCP server for web search and URL/resource loading. It works without API keys by default and stays local-first: search uses free providers, `fetch_url` extracts useful content from URLs, and binary/media downloads only happen when explicitly requested.

## Features

- `search_web` - multi-provider web search with automatic fallback across DuckDuckGo, Bing, and SearXNG.
- `fetch_url` - universal URL/resource loader for HTML, PDF, text, Markdown, JSON, XML, CSV, media metadata, and supported site-specific URLs.
- Clean normalized output with one `content` field plus metadata, pagination, links, media, attachments, and warnings.
- Reddit thread extraction through Reddit JSON endpoints instead of brittle Reddit HTML scraping.
- Long-resource pagination with `max_length`, `start_index`, and `next_start_index`.
- Optional HTML link/media summaries.
- Optional local download artifacts with `download: true`.
- SSRF protection for localhost, private IPs, link-local ranges, IPv6 private ranges, and unsafe redirects.
- No paid API required.

## Requirements

- Node.js 18+
- Chrome/Chromium only if you use the Bing provider

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

### Custom Configuration

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

## Tools

### search_web

Search the web through one provider or through the fallback chain.

Input:

```json
{
  "q": "openai codex reddit review",
  "limit": 10,
  "lang": "en",
  "provider": "duckduckgo"
}
```

Options:

| Option     | Description                                           |
| ---------- | ----------------------------------------------------- |
| `q`        | Search query                                          |
| `limit`    | Number of results, 1-50                               |
| `lang`     | Search language, default `en`                         |
| `provider` | Optional provider: `duckduckgo`, `bing`, or `searxng` |

Output:

```json
{
  "items": [
    {
      "title": "Example Result",
      "url": "https://example.com",
      "snippet": "Result summary...",
      "source": "duckduckgo"
    }
  ],
  "providerUsed": "duckduckgo",
  "fallbackUsed": false,
  "triedProviders": ["duckduckgo"]
}
```

Fallback order:

- DuckDuckGo → SearXNG → Bing
- SearXNG → DuckDuckGo → Bing
- Bing → DuckDuckGo → SearXNG

### fetch_url

Fetch a URL and return extracted content plus metadata in a normalized envelope.

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

Options:

| Option                 | Description                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `url`                  | URL to fetch                                                                                      |
| `format`               | `markdown`, `text`, `html`, `json`, `raw`, or `metadata`                                          |
| `max_length`           | Maximum returned content characters, default 25000                                                |
| `start_index`          | Start content from this character index                                                           |
| `engine`               | `auto`, `http`, or `browser`; browser fallback is reserved for future optional support            |
| `include_links`        | Include extracted links for HTML pages                                                            |
| `include_media`        | Include extracted image/video/audio references for HTML pages                                     |
| `include_comments`     | Include comments for site adapters that support comments, default true for Reddit                 |
| `comment_limit`        | Maximum comments for comment-capable adapters, max 100                                            |
| `comment_sort`         | `top`, `best`, `new`, or `controversial`                                                          |
| `max_depth`            | Maximum comment nesting depth                                                                     |
| `timeout_ms`           | Request timeout override                                                                          |
| `fresh`                | Bypass in-memory cache                                                                            |
| `download`             | Save original fetched bytes to a managed local file and return it in `attachments`; default false |
| `download_dir`         | Optional output directory for downloads; defaults to the system temp directory                    |
| `download_ttl_seconds` | Cleanup TTL for managed downloads, default 86400 seconds                                          |
| `max_download_bytes`   | Response/download byte cap override, additionally capped by `MAX_BYTES`                           |

Output:

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
  "links": [],
  "media": {
    "images": [],
    "videos": [],
    "audio": []
  },
  "truncated": false,
  "original_length": 1200,
  "start_index": 0,
  "next_start_index": null,
  "warnings": []
}
```

## Supported Resources

| Resource                  | Behavior                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| HTML pages                | Extracts readable article content, title, metadata, optional links, and optional media references      |
| Text and Markdown         | Returns text directly with pagination support                                                          |
| JSON                      | Pretty-prints JSON when `format` is `json` or text-like when requested                                 |
| XML and CSV-like text     | Returns as text/data content                                                                           |
| PDF                       | Extracts text and PDF metadata                                                                         |
| Images                    | Returns metadata by default; saves the file only with `download: true`                                 |
| Audio and video           | Returns metadata by default; saves the file only with `download: true`                                 |
| Archives and binary files | Returns metadata by default; downloads only when explicitly requested; archives are not auto-extracted |
| Reddit threads            | Uses Reddit JSON endpoints and can include comments with limits                                        |

## Local Downloads

`fetch_url` does not download binary/media files to disk by default. This avoids surprise disk usage and persistent local copies of arbitrary web content.

Use `download: true` when you need the original file available to another tool:

```json
{
  "url": "https://httpbin.org/image/png",
  "format": "metadata",
  "download": true,
  "download_ttl_seconds": 86400
}
```

Download attachments look like this:

```json
{
  "kind": "download",
  "path": "/tmp/mcp-web-search/downloads/mcp-fetch-id-image.png",
  "filename": "mcp-fetch-id-image.png",
  "original_filename": "image.png",
  "content_type": "image/png",
  "resource_type": "image",
  "byte_length": 8090,
  "sha256": "...",
  "expires_at": "2026-05-04T00:00:00.000Z"
}
```

Download safety behavior:

- Downloads are opt-in only.
- Files are written with `0600` permissions.
- Filenames are sanitized and prefixed with a managed artifact ID.
- SHA-256 is returned for verification.
- Expired managed artifacts are cleaned up through sidecar metadata.
- Cleanup only touches managed artifacts inside the configured download directory.
- Archives are never auto-extracted.

## Reddit Thread Extraction

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

Reddit public JSON can still rate-limit or return 403/429 depending on Reddit, subreddit rules, and request frequency. When that happens, retry later or reduce request frequency.

## Providers

| Provider   | API Key Required | Notes                                         |
| ---------- | ---------------- | --------------------------------------------- |
| DuckDuckGo | No               | Default, simple, no browser required          |
| Bing       | No               | Uses Chrome/Chromium through Puppeteer        |
| SearXNG    | No               | Best option for self-hosted high-volume usage |

## Environment Variables

| Variable                  | Default                 | Description                                                                                  |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `DEFAULT_SEARCH_PROVIDER` | `duckduckgo`            | Default search provider: `duckduckgo`, `bing`, or `searxng`                                  |
| `SEARXNG_URL`             | `http://localhost:8099` | SearXNG instance URL                                                                         |
| `HTTP_TIMEOUT`            | `15000`                 | Request timeout in milliseconds                                                              |
| `MAX_BYTES`               | `20971520`              | Maximum fetched response/download size                                                       |
| `MCP_COMPAT_MODE`         | unset                   | Set to `legacy` to simplify `tools/list` schemas for MCP clients with weak discovery parsers |

## SearXNG Setup

SearXNG is a free self-hosted meta-search engine.

Quick setup with Docker:

```bash
mkdir -p ~/docker/searxng
```

Create `~/docker/searxng/settings.yml` with JSON enabled, then run the SearXNG container. The important setting is `search.formats` containing both `html` and `json`.

Example relevant setting:

```yaml
search:
  formats:
    - html
    - json
```

Then set:

```bash
export SEARXNG_URL="http://localhost:8099"
```

## Chrome Setup for Bing Provider

| OS            | Command                             |
| ------------- | ----------------------------------- |
| Ubuntu/Debian | `sudo apt install chromium-browser` |
| Fedora        | `sudo dnf install chromium`         |
| Arch          | `sudo pacman -S chromium`           |
| macOS         | `brew install --cask google-chrome` |

Custom path:

```bash
export CHROME_PATH="/path/to/chrome"
```

## MCP Discovery Compatibility

Some MCP clients have weak schema parsers and fail during discovery on array-valued JSON Schema nodes such as `enum` or `required`.

If discovery fails, set:

```bash
export MCP_COMPAT_MODE="legacy"
```

This only simplifies advertised `tools/list` schemas. Tool execution behavior stays the same.

## URL Safety

`fetch_url` blocks unsafe targets before fetching and before following redirects.

Blocked targets include:

- localhost hostnames
- `.localhost` and `.local` hostnames
- private IPv4 ranges
- IPv4 loopback, link-local, carrier-grade NAT, benchmark, multicast, and selected special-use ranges
- IPv4-mapped IPv6 addresses that resolve to blocked IPv4 ranges
- IPv6 loopback, unspecified, unique-local, multicast, and link-local ranges
- redirects that resolve to blocked addresses

The HTTP transport resolves and validates addresses before connecting, then connects to the vetted address while preserving the original host/SNI for normal HTTPS behavior.

## Repository Structure

- `src/server.ts` - MCP server and tool schemas
- `src/providers/` - search providers
- `src/fetch/` - URL/resource loading pipeline
- `src/fetch/content/` - shared content helpers such as Markdown conversion and readability fallback
- `src/fetch/extractors/` - resource extractors for HTML, text/data, PDF, and media metadata
- `src/fetch/site-adapters/` - domain-specific extractors such as Reddit threads
- `src/utils/` - shared utilities
- `test/` - Node test runner tests

## Troubleshooting

| Issue                                                       | Solution                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chrome not found                                            | Install Chrome/Chromium or set `CHROME_PATH`                                              |
| SearXNG 403                                                 | Enable JSON API in `settings.yml`                                                         |
| Timeout                                                     | Increase `HTTP_TIMEOUT` or pass `timeout_ms`                                              |
| MCP discovery error: `'list' object has no attribute 'get'` | Set `MCP_COMPAT_MODE=legacy`                                                              |
| Reddit 429 or 403                                           | Reddit rate limited or blocked the JSON endpoint; retry later or reduce request frequency |
| Download missing from output                                | Set `download: true`; downloads are disabled by default                                   |
| Download rejected as too large                              | Increase `max_download_bytes` within the server cap or raise `MAX_BYTES`                  |

## License

MIT
