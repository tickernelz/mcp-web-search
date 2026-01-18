# mcp-web-search

MCP server providing web search, Wikipedia summaries, and URL content extraction without requiring API keys.

**Version:** 1.0.0

## Features

- **search_web** - Two-tier web search (Fast: DuckDuckGo HTML, Deep: Puppeteer/Bing)
- **fetch_url** - Extract content from URLs (HTML/PDF) using Readability and pdf-parse
- **summarize_url** - Fetch and summarize URL content
- **wiki_get** - Retrieve Wikipedia summary by language
- **wiki_multi** - Retrieve Wikipedia summaries in multiple languages

## Requirements

- Node.js 18+
- Windows/macOS/Linux
- Chrome or Chromium browser (for deep search mode)

## Installation

```bash
npm install
```

### Chrome/Chromium Setup

Deep search mode requires Chrome or Chromium to be installed on your system.

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install chromium-browser

# Fedora
sudo dnf install chromium

# Arch
sudo pacman -S chromium
```

**macOS:**
```bash
brew install --cask google-chrome
```

**Windows:**
Download from [https://www.google.com/chrome/](https://www.google.com/chrome/)

**Custom Chrome Path:**
If Chrome is installed in a non-standard location, set the `CHROME_PATH` environment variable:
```bash
export CHROME_PATH=/path/to/chrome
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
| `CHROME_PATH` | (auto-detect) | Custom path to Chrome/Chromium executable |

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
    source: "ddg_html" | "bing_puppeteer";
  }>;
  modeUsed: "fast"|"deep"|"auto";
  enginesUsed: ("ddg_html"|"bing_puppeteer")[];
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
  text?: string;             // Plain text (only if format is "text")
  markdown?: string;         // Markdown format (only if format is "markdown")
  format: "markdown" | "text"; // Which format is returned
  url: string;
  title?: string;
  byline?: string;
  siteName?: string;
  lang?: string;
  length?: number;
}
```

**Example (Markdown):**
```json
{
  "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples...",
  "format": "markdown",
  "url": "https://example.com",
  "title": "Example Domain",
  "length": 150
}
```

**Example (Text fallback):**
```json
{
  "text": "Example Domain This domain is for use in illustrative examples...",
  "format": "text",
  "url": "https://example.com",
  "title": "Example Domain",
  "length": 150
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
- Attempts to use MCP client's model (if available) to generate summary
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

**Chrome not found error**
- Ensure Chrome or Chromium is installed on your system
- Set `CHROME_PATH` environment variable to your Chrome executable path
- Check installation instructions above for your operating system

**CAPTCHA or temporary blocks**
- Reduce request frequency
- Use `mode="fast"` to avoid headless browser
- Wait a few minutes before retrying

**Chrome/Chromium not installed**
- Deep search mode requires Chrome/Chromium
- Install using instructions in the Installation section above
- Or set `CHROME_PATH` to existing Chrome installation

**Timeout or hanging downloads**
- Increase `HTTP_TIMEOUT` environment variable
- Content may exceed `MAX_BYTES` limit

**Internal URLs blocked**
- This is intentional SSRF protection
- Only public URLs are allowed

## License

MIT - See LICENSE file for details.
