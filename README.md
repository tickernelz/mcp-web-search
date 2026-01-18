# MCP Web Search
[![npm version](https://img.shields.io/npm/v/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![npm downloads](https://img.shields.io/npm/dm/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)
[![license](https://img.shields.io/npm/l/@zhafron/mcp-web-search)](https://www.npmjs.com/package/@zhafron/mcp-web-search)

MCP server: web search, Wikipedia summaries, and URL content extraction. No API keys required.

## Features

- search_web - Two-tier web search (DuckDuckGo HTML / Puppeteer/Bing)
- fetch_url - Extract content with semantic truncation
- summarize_url - Fetch and summarize URL content
- wiki_get - Wikipedia summary by language
- wiki_multi - Wikipedia summaries in multiple languages

## Requirements

- Node.js 18+
- Chrome/Chromium (for deep search mode)

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

### Generic / Others

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "@zhafron/mcp-web-search"],
      "env": {}
    }
  }
}
```

## Chrome Setup

| OS | Command |
|----|---------|
| Ubuntu/Debian | sudo apt install chromium-browser |
| Fedora | sudo dnf install chromium |
| Arch | sudo pacman -S chromium |
| macOS | brew install --cask google-chrome |

Custom path: `export CHROME_PATH=/path/to/chrome`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| CHROME_PATH | auto-detect | Chrome executable path |
| HTTP_TIMEOUT | 15000 | Request timeout (ms) |
| USER_AGENT | mcp-web-search/1.1 | User agent string |

SSRF Protection: Blocks localhost, 127.0.0.1, ::1, .local domains.

## Tools

### search_web

Input: `{ q: string, limit?: number, lang?: string, mode?: "fast"|"deep"|"auto" }`

Output: `{ items: Array<{ title, url, snippet?, source }>, modeUsed, enginesUsed, escalated }`

### fetch_url

Input: `{ url: string, mode?: "compact"|"standard"|"full", max_length?: number, format?: "markdown"|"text" }`

| Mode | Characters | Tokens |
|------|------------|--------|
| compact | ~3000 | ~750 |
| standard | ~8000 | ~2000 |
| full | unlimited | - |

Output: `{ markdown?, text?, format, url, title?, truncated?, original_length? }`

### summarize_url

Input: `{ url: string }`

### wiki_get

Input: `{ title: string, lang?: string }`

Output: `{ lang, title, url, description?, extract?, thumbnailUrl? }`

### wiki_multi

Input: `{ term: string, baseLang?: string, langs?: string[] }`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chrome not found | Install Chrome or set CHROME_PATH |
| CAPTCHA/blocks | Reduce frequency, use fast mode |
| Timeout | Increase HTTP_TIMEOUT |

## License

MIT
