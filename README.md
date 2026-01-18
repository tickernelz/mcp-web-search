# mcp-web-search

MCP server providing web search, Wikipedia summaries, and URL content extraction without requiring API keys.

**Version:** 1.0.0

## Features

- **search_web** - Two-tier web search (Fast: DuckDuckGo HTML, Deep: Playwright/Bing)
- **fetch_url** - Extract content from URLs (HTML/PDF) using Readability and pdf-parse
- **summarize_url** - Fetch and summarize URL content
- **wiki_get** - Retrieve Wikipedia summary by language
- **wiki_multi** - Retrieve Wikipedia summaries in multiple languages

## Requirements

- Node.js 18+
- Windows/macOS/Linux
- Playwright Chromium (for deep search mode)

## Installation

```bash
npm install
npx playwright install chromium
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm run start
```

## Environment Variables

Configure in LM Studio or via `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `USER_AGENT` | `mcp-web-search/1.0` | User agent string for HTTP requests |
| `HTTP_TIMEOUT` | `15000` | Timeout in milliseconds for network requests |
| `MAX_RESULTS` | `10` | Default maximum results for search_web |
| `LANG_DEFAULT` | `en` | Default language code |
| `MAX_BYTES` | `20971520` | Maximum download size (20MB) for fetch_url |

**SSRF Protection:** `fetch_url` blocks localhost, 127.0.0.1, ::1, .local, and .localhost domains.

## MCP Client Configuration

Configure in your MCP client (Claude Desktop, LM Studio, etc.):

**Example for LM Studio:**
1. Open **Settings → Developer → Model Context Protocol (MCP) Servers**
2. Click **Add**
3. Configure:
   - **Name:** `mcp-web-search`
   - **Command:** `npm`
   - **Args:** `run`, `dev` (or `start` for production)
   - **Working directory:** Path to project directory
   - **Environment variables:** Add variables from table above as needed

**Example for Claude Desktop:**
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mcp-web-search": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/mcp-web-search",
      "env": {
        "USER_AGENT": "mcp-web-search/1.0",
        "LANG_DEFAULT": "en"
      }
    }
  }
}
```

When running successfully, logs will show: `mcp-web-search ready (stdio)...`

## Tool Reference

### search_web

Two-tier web search with automatic escalation.

**Input:**
```typescript
{
  q: string;
  limit?: number;          // 1-50, default: MAX_RESULTS env
  lang?: string;           // default: "en"
  mode?: "fast"|"deep"|"auto"; // default: "auto"
}
```

**Output:**
```typescript
{
  items: Array<{
    title: string;
    url: string;
    snippet?: string;
    source: "ddg_html" | "bing_pw";
  }>;
  modeUsed: "fast"|"deep"|"auto";
  enginesUsed: ("ddg_html"|"bing_pw")[];
  escalated: boolean;
  diagnostics?: Record<string, unknown>;
}
```

**Example:**
```json
{
  "q": "Node.js LTS release schedule",
  "mode": "fast",
  "limit": 5,
  "lang": "en"
}
```

### fetch_url

Fetch and extract readable content from URLs.

**Input:**
```typescript
{
  url: string;  // Supports HTML and PDF
}
```

**Output:**
```typescript
{
  text: string;
  url: string;
  title?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
  length?: number;
}
```

**Example:**
```json
{
  "url": "https://example.com/article"
}
```

### summarize_url

Fetch URL content and generate a concise summary.

**Input:**
```typescript
{
  url: string;
}
```

**Behavior:**
- Fetches content using `fetch_url`
- Attempts to use LM Studio's model (if available) to generate summary
- Falls back to first 2000 characters if model unavailable

**Example:**
```json
{
  "url": "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"
}
```

### wiki_get

Retrieve Wikipedia summary for a specific title.

**Input:**
```typescript
{
  title: string;
  lang?: string;  // default: "en"
}
```

**Output:**
```typescript
{
  lang: string;
  title: string;
  url: string;
  description?: string;
  extract?: string;
  thumbnailUrl?: string;
}
```

**Example:**
```json
{
  "title": "Lambda calculus",
  "lang": "en"
}
```

### wiki_multi

Retrieve Wikipedia summaries in multiple languages.

**Input:**
```typescript
{
  term: string;
  baseLang?: string;      // default: "en"
  langs?: string[];       // default: ["en"]
}
```

**Output:**
```typescript
{
  baseLang: string;
  base: WikiSummary;
  items: Record<string, WikiSummary | null>;
  resolved: Record<string, {
    title?: string;
    source: "base" | "langlinks" | "direct" | "none";
  }>;
}
```

**Example:**
```json
{
  "term": "Artificial intelligence",
  "baseLang": "en",
  "langs": ["en", "es", "fr", "de"]
}
```

## Quick Test Examples

```
search_web: { "q": "site:developer.apple.com App Intents", "mode": "deep", "limit": 5 }
fetch_url: { "url": "https://example.com" }
summarize_url: { "url": "https://www.python.org/dev/peps/pep-0008/" }
wiki_get: { "title": "Lambda calculus", "lang": "en" }
wiki_multi: { "term": "Machine learning", "langs": ["en", "es", "fr"] }
```

## Troubleshooting

**CAPTCHA or temporary blocks**
- Reduce request frequency
- Use `mode="fast"` to avoid Playwright
- Wait a few minutes before retrying

**Playwright not installed**
```bash
npx playwright install chromium
```

**Timeout or hanging downloads**
- Increase `HTTP_TIMEOUT` environment variable
- Content may exceed `MAX_BYTES` limit

**Internal URLs blocked**
- This is intentional SSRF protection
- Only public URLs are allowed

## License

MIT - See LICENSE file for details.
