# MCP Web Search

MCP server: web search, Wikipedia summaries, and URL content extraction. No API keys required.

## Features

- search_web - Two-tier web search (DuckDuckGo HTML / Puppeteer/Bing)
- fetch_url - Extract content from URLs with semantic truncation
- summarize_url - Fetch and summarize URL content
- wiki_get - Wikipedia summary by language
- wiki_multi - Wikipedia summaries in multiple languages

## Requirements

- Node.js 18+
- Windows/macOS/Linux
- Chrome/Chromium (for deep search mode)

## Installation

```bash
npm install
```

## Chrome Installation

| OS | Command |
|----|---------|
| Ubuntu/Debian | sudo apt install chromium-browser |
| Fedora | sudo dnf install chromium |
| Arch | sudo pacman -S chromium |
| macOS | brew install --cask google-chrome |

Custom path: `export CHROME_PATH=/path/to/chrome`

## Commands

```bash
npm run dev    # Development
npm run build  # Build
npm run start  # Production
npm test       # Run tests
npm run format # Format code
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| USER_AGENT | mcp-web-search/1.0 | User agent string |
| HTTP_TIMEOUT | 15000 | Request timeout (ms) |
| MAX_RESULTS | 10 | Default search limit |
| LANG_DEFAULT | en | Default language |
| MAX_BYTES | 20971520 | Max download size |
| CHROME_PATH | auto-detect | Chrome executable path |

SSRF Protection: Blocks localhost, 127.0.0.1, ::1, .local domains.

## Tool Reference

### search_web

Two-tier web search.

Input: `{ q: string, limit?: number, lang?: string, mode?: "fast"|"deep"|"auto" }`

Output: `{ items: Array<{ title, url, snippet?, source }>, modeUsed, enginesUsed, escalated }`

Example: `{ "q": "Node.js LTS", "mode": "fast", "limit": 5 }`

### fetch_url

Extract content with intelligent truncation.

Input: `{ url: string, mode?: "compact"|"standard"|"full", max_length?: number, format?: "markdown"|"text"|"html" }`

| Mode | Characters | Tokens | Use Case |
|------|------------|--------|----------|
| compact | ~3000 | ~750 | Quick summaries |
| standard | ~8000 | ~2000 | Balanced (default) |
| full | unlimited | - | Full content |

max_length: Exact character limit (1000-100000), overrides mode.

format: Output format (markdown, text, html). Default: markdown.

Truncation: Semantic chunking prioritizes headings, code blocks, conclusions.

Output: `{ markdown?, text?, format, url, title?, truncated?, original_length?, truncation_ratio? }`

Examples:
- `{ "url": "https://example.com", "mode": "compact" }`
- `{ "url": "https://example.com", "format": "text" }`
- `{ "url": "https://example.com", "format": "markdown" }`
- `{ "url": "https://example.com", "max_length": 5000 }`

### summarize_url

Fetch and summarize URL content.

Input: `{ url: string }`

### wiki_get

Wikipedia summary by language.

Input: `{ title: string, lang?: string }`

Output: `{ lang, title, url, description?, extract?, thumbnailUrl? }`

### wiki_multi

Wikipedia summaries in multiple languages.

Input: `{ term: string, baseLang?: string, langs?: string[] }`

## Quick Examples

```
search_web: { "q": "App Intents", "mode": "deep", "limit": 5 }
fetch_url: { "url": "https://example.com", "mode": "compact" }
summarize_url: { "url": "https://python.org/pep-8" }
wiki_get: { "title": "Lambda calculus", "lang": "en" }
wiki_multi: { "term": "AI", "langs": ["en", "es", "fr"] }
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chrome not found | Install Chrome or set CHROME_PATH |
| CAPTCHA/blocks | Reduce frequency, use fast mode |
| Timeout | Increase HTTP_TIMEOUT, check MAX_BYTES |
| Blocked URL | SSRF protection, public URLs only |

## License

MIT
