# MCP Web Search
[![npm version](https://img.shields.io/npm/v/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![npm downloads](https://img.shields.io/npm/dm/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![license](https://img.shields.io/npm/l/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)

MCP server: web search and URL content extraction. No API keys required.

## Features

- **search_web** - Multi-provider web search with automatic fallback (DuckDuckGo, Bing, SearXNG)
- **fetch_url** - Extract content from URLs with semantic truncation

## Providers

| Provider | API Key Required | Description |
|----------|------------------|-------------|
| **DuckDuckGo** | No | HTML scraping, fast and simple |
| **Bing** | No | Puppeteer-based search (requires Chrome) |
| **SearXNG** | No | Self-hosted meta-search, unlimited usage |

## Requirements

- Node.js 18+
- Chrome/Chromium (for Bing provider)

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
| `DEFAULT_SEARCH_PROVIDER` | `duckduckgo` | Default search provider (duckduckgo, bing, searxng) |
| `SEARXNG_URL` | `http://localhost:8099` | SearXNG instance URL |
| `HTTP_TIMEOUT` | `15000` | Request timeout (ms) |

## Anti-Bot Detection

This package uses realistic, rotating user agents to minimize bot detection:
- Random user agents from real browsers (Chrome, Firefox, Safari, Edge)
- Always up-to-date browser versions
- Desktop device category for consistency
- Different user agent per request

## Chrome Setup (for Bing Provider)

| OS | Command |
|----|---------|
| Ubuntu/Debian | sudo apt install chromium-browser |
| Fedora | sudo dnf install chromium |
| Arch | sudo pacman -S chromium |
| macOS | brew install --cask google-chrome |

Custom path: `export CHROME_PATH=/path/to/chrome`

## Tools

### search_web

Input: `{ q: string, limit?: number, lang?: string, provider?: "duckduckgo"|"bing"|"searxng" }`

Output: `{ items: Array<{ title, url, snippet?, source }>, providerUsed, fallbackUsed, triedProviders }`

**Automatic Fallback:**
- If default provider fails, automatically tries other providers
- Fallback order: DuckDuckGo → SearXNG → Bing (or vice versa based on default)

### fetch_url

Input: `{ url: string, mode?: "compact"|"standard"|"full", max_length?: number, format?: "markdown"|"text"|"html" }`

| Mode | Characters | Tokens |
|------|------------|--------|
| compact | ~3000 | ~750 |
| standard | ~8000 | ~2000 |
| full | unlimited | - |

Output: `{ markdown?, text?, format, url, title?, truncated?, original_length? }`

## SearXNG Setup

SearXNG is a free, self-hosted meta-search engine. Quick setup with Docker:

```bash
mkdir -p ~/docker/searxng && echo 'use_default_settings: true
search:
  safe_search: 0
  formats:
    - html
    - json
server:
  secret_key: "your_secret_key_here"
  limiter: false
  image_proxy: true
outgoing:
  request_timeout: 10.0
  max_request_timeout: 15.0' > ~/docker/searxng/settings.yml && docker run -d --name searxng -p 8099:8080 -v ~/docker/searxng/settings.yml:/etc/searxng/settings.yml:ro searxng/searxng:latest
```

## SSRF Protection

Blocks localhost, 127.0.0.1, ::1, .local domains.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chrome not found | Install Chrome or set CHROME_PATH |
| SearXNG 403 | Enable JSON API in settings.yml |
| Timeout | Increase HTTP_TIMEOUT |

## License

MIT
