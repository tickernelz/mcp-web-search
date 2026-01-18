import type { ExtractionOptions, ContentChunk, TruncationResult } from "./types.js";

const MODE_LIMITS: Record<string, number> = {
  compact: 3000,
  standard: 8000,
  full: Infinity
};

const KEYWORDS = [
  "summary",
  "conclusion",
  "important",
  "overview",
  "introduction",
  "key",
  "main",
  "abstract"
];

export function applySmartTruncation(
  content: string,
  format: "markdown" | "text",
  options?: ExtractionOptions
): TruncationResult {
  const mode = options?.mode || "standard";
  const maxLength = options?.max_length || MODE_LIMITS[mode] || MODE_LIMITS.standard;

  if (maxLength === Infinity || content.length <= maxLength) {
    return {
      content,
      truncated: false,
      original_length: content.length,
      final_length: content.length
    };
  }

  if (format === "markdown") {
    return truncateMarkdown(content, maxLength);
  } else {
    return truncateText(content, maxLength);
  }
}

export function truncateMarkdown(content: string, maxLength: number): TruncationResult {
  const chunks = parseMarkdownChunks(content);

  if (chunks.length === 0) {
    return {
      content: balancedTruncate(content, maxLength),
      truncated: true,
      original_length: content.length,
      final_length: Math.min(content.length, maxLength)
    };
  }

  chunks.forEach((chunk, idx) => {
    chunk.score = scoreChunk(chunk, chunks.length);
    chunk.position = idx;
  });

  const selected = selectChunks(chunks, maxLength);
  const assembled = assembleChunks(selected);

  return {
    content: assembled,
    truncated: true,
    original_length: content.length,
    final_length: assembled.length,
    chunks_selected: selected.length,
    chunks_total: chunks.length
  };
}

export function truncateText(content: string, maxLength: number): TruncationResult {
  const chunks = parseSentences(content);

  if (chunks.length === 0) {
    return {
      content: balancedTruncate(content, maxLength),
      truncated: true,
      original_length: content.length,
      final_length: Math.min(content.length, maxLength)
    };
  }

  chunks.forEach((chunk, idx) => {
    chunk.score = scoreChunk(chunk, chunks.length);
    chunk.position = idx;
  });

  const selected = selectChunks(chunks, maxLength);
  const assembled = assembleChunks(selected);

  return {
    content: assembled,
    truncated: true,
    original_length: content.length,
    final_length: assembled.length,
    chunks_selected: selected.length,
    chunks_total: chunks.length
  };
}

export function parseMarkdownChunks(markdown: string): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  const lines = markdown.split("\n");
  let currentChunk: string[] = [];
  let currentType: ContentChunk["type"] = "paragraph";
  let inCodeBlock = false;

  const flushChunk = () => {
    if (currentChunk.length > 0) {
      const content = currentChunk.join("\n").trim();
      if (content) {
        chunks.push({
          content,
          type: currentType,
          position: 0,
          score: 0,
          length: content.length
        });
      }
      currentChunk = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        currentChunk.push(line);
        flushChunk();
        inCodeBlock = false;
        currentType = "paragraph";
      } else {
        flushChunk();
        inCodeBlock = true;
        currentType = "code";
        currentChunk.push(line);
      }
      continue;
    }

    if (inCodeBlock) {
      currentChunk.push(line);
      continue;
    }

    if (line.match(/^#{1,6}\s/)) {
      flushChunk();
      currentType = "heading";
      currentChunk.push(line);
      flushChunk();
      currentType = "paragraph";
    } else if (line.match(/^[\s]*[-*+]\s/) || line.match(/^[\s]*\d+\.\s/)) {
      if (currentType !== "list") {
        flushChunk();
        currentType = "list";
      }
      currentChunk.push(line);
    } else if (line.trim() === "") {
      if (currentType === "list") {
        flushChunk();
        currentType = "paragraph";
      }
    } else {
      if (currentType === "list") {
        flushChunk();
        currentType = "paragraph";
      }
      currentChunk.push(line);
    }
  }

  flushChunk();
  return chunks;
}

export function parseSentences(text: string): ContentChunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.map(sentence => ({
    content: sentence.trim(),
    type: "text" as const,
    position: 0,
    score: 0,
    length: sentence.trim().length
  }));
}

export function scoreChunk(chunk: ContentChunk, totalChunks: number): number {
  let score = 0;

  if (chunk.type === "heading") {
    score += 20;
  } else if (chunk.type === "code") {
    score += 10;
  } else if (chunk.type === "list") {
    score += 5;
  }

  const positionRatio = chunk.position / Math.max(totalChunks - 1, 1);
  if (positionRatio <= 0.15) {
    score += 15;
  } else if (positionRatio >= 0.85) {
    score += 12;
  }

  if (chunk.length >= 100 && chunk.length <= 1000) {
    score += 5;
  } else if (chunk.length > 300) {
    score += 3;
  }

  const lowerContent = chunk.content.toLowerCase();
  for (const keyword of KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      score += 5;
    }
  }

  if (chunk.length < 50) {
    score -= 10;
  }

  return score;
}

export function selectChunks(chunks: ContentChunk[], maxLength: number): ContentChunk[] {
  const selected: ContentChunk[] = [];
  let currentLength = 0;

  const firstHeading = chunks.find(c => c.type === "heading");
  if (firstHeading) {
    selected.push(firstHeading);
    currentLength += firstHeading.length + 5;
  }

  const sortedChunks = [...chunks]
    .filter(c => !selected.includes(c))
    .sort((a, b) => b.score - a.score);

  for (const chunk of sortedChunks) {
    const chunkLength = chunk.length + 5;
    if (currentLength + chunkLength <= maxLength) {
      selected.push(chunk);
      currentLength += chunkLength;
    }
  }

  return selected.sort((a, b) => a.position - b.position);
}

export function assembleChunks(chunks: ContentChunk[]): string {
  if (chunks.length === 0) return "";

  const parts: string[] = [];
  let lastPosition = -1;

  for (const chunk of chunks) {
    if (lastPosition >= 0 && chunk.position > lastPosition + 1) {
      parts.push("[...]");
    }
    parts.push(chunk.content);
    lastPosition = chunk.position;
  }

  return parts.join("\n\n");
}

export function balancedTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const startLen = Math.floor(maxLength * 0.4);
  const middleLen = Math.floor(maxLength * 0.3);
  const endLen = maxLength - startLen - middleLen - 10;

  const start = text.slice(0, startLen);
  const middleStart = Math.floor((text.length - middleLen) / 2);
  const middle = text.slice(middleStart, middleStart + middleLen);
  const end = text.slice(-endLen);

  return `${start}\n[...]\n${middle}\n[...]\n${end}`;
}
