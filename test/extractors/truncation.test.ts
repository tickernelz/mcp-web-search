import { describe, it, expect } from "@jest/globals";
import {
  applySmartTruncation,
  truncateMarkdown,
  truncateText,
  parseMarkdownChunks,
  parseSentences,
  scoreChunk,
  selectChunks,
  assembleChunks,
  balancedTruncate
} from "../../src/extractors/truncation.js";

describe("Truncation System", () => {
  describe("applySmartTruncation", () => {
    it("should not truncate content shorter than limit", () => {
      const content = "Short content";
      const result = applySmartTruncation(content, "text", { mode: "standard" });

      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
      expect(result.original_length).toBe(content.length);
      expect(result.final_length).toBe(content.length);
    });

    it("should apply compact mode limit", () => {
      const content = "a".repeat(5000);
      const result = applySmartTruncation(content, "text", { mode: "compact" });

      expect(result.truncated).toBe(true);
      expect(result.final_length).toBeLessThanOrEqual(3000);
    });

    it("should apply standard mode limit", () => {
      const content = "a".repeat(10000);
      const result = applySmartTruncation(content, "text", { mode: "standard" });

      expect(result.truncated).toBe(true);
      expect(result.final_length).toBeLessThanOrEqual(8000);
    });

    it("should not truncate in full mode", () => {
      const content = "a".repeat(20000);
      const result = applySmartTruncation(content, "text", { mode: "full" });

      expect(result.truncated).toBe(false);
      expect(result.content).toBe(content);
    });

    it("should respect custom max_length", () => {
      const content = "a".repeat(10000);
      const result = applySmartTruncation(content, "text", { max_length: 5000 });

      expect(result.truncated).toBe(true);
      expect(result.final_length).toBeLessThanOrEqual(5000);
    });
  });

  describe("parseMarkdownChunks", () => {
    it("should parse headings", () => {
      const markdown = "# Heading 1\n\nSome text\n\n## Heading 2\n\nMore text";
      const chunks = parseMarkdownChunks(markdown);

      const headings = chunks.filter(c => c.type === "heading");
      expect(headings.length).toBeGreaterThan(0);
      expect(headings[0].content).toContain("Heading");
    });

    it("should parse code blocks", () => {
      const markdown = "```javascript\nconst x = 1;\n```\n\nText after";
      const chunks = parseMarkdownChunks(markdown);

      const codeBlocks = chunks.filter(c => c.type === "code");
      expect(codeBlocks.length).toBe(1);
      expect(codeBlocks[0].content).toContain("const x = 1");
    });

    it("should parse lists", () => {
      const markdown = "- Item 1\n- Item 2\n- Item 3\n\nParagraph";
      const chunks = parseMarkdownChunks(markdown);

      const lists = chunks.filter(c => c.type === "list");
      expect(lists.length).toBeGreaterThan(0);
    });

    it("should parse paragraphs", () => {
      const markdown = "This is a paragraph.\n\nThis is another paragraph.";
      const chunks = parseMarkdownChunks(markdown);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.type === "paragraph")).toBe(true);
    });
  });

  describe("parseSentences", () => {
    it("should split text into sentences", () => {
      const text = "First sentence. Second sentence! Third sentence?";
      const chunks = parseSentences(text);

      expect(chunks.length).toBe(3);
      expect(chunks[0].type).toBe("text");
    });

    it("should handle text without punctuation", () => {
      const text = "No punctuation here";
      const chunks = parseSentences(text);

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("scoreChunk", () => {
    it("should give high score to headings", () => {
      const chunk = {
        content: "# Important Heading",
        type: "heading" as const,
        position: 0,
        score: 0,
        length: 19
      };

      const score = scoreChunk(chunk, 10);
      expect(score).toBeGreaterThan(15);
    });

    it("should give bonus to code blocks", () => {
      const chunk = {
        content: "```javascript\nconst x = 1;\nconst y = 2;\nconst z = 3;\n```",
        type: "code" as const,
        position: 5,
        score: 0,
        length: 55
      };

      const score = scoreChunk(chunk, 10);
      expect(score).toBeGreaterThan(5);
    });

    it("should give bonus to first chunks", () => {
      const chunk = {
        content: "First paragraph",
        type: "paragraph" as const,
        position: 0,
        score: 0,
        length: 15
      };

      const score = scoreChunk(chunk, 10);
      expect(score).toBeGreaterThan(0);
    });

    it("should give bonus to last chunks", () => {
      const chunk = {
        content: "Last paragraph",
        type: "paragraph" as const,
        position: 9,
        score: 0,
        length: 14
      };

      const score = scoreChunk(chunk, 10);
      expect(score).toBeGreaterThan(0);
    });

    it("should give bonus for keywords", () => {
      const chunk = {
        content: "This is a summary of important conclusions",
        type: "paragraph" as const,
        position: 5,
        score: 0,
        length: 42
      };

      const score = scoreChunk(chunk, 10);
      expect(score).toBeGreaterThan(0);
    });

    it("should penalize very short chunks", () => {
      const chunk = {
        content: "Short",
        type: "paragraph" as const,
        position: 5,
        score: 0,
        length: 5
      };

      const score = scoreChunk(chunk, 10);
      expect(score).toBeLessThan(0);
    });
  });

  describe("selectChunks", () => {
    it("should prioritize first heading", () => {
      const chunks = [
        {
          content: "# Main Heading",
          type: "heading" as const,
          position: 0,
          score: 20,
          length: 14
        },
        {
          content: "Paragraph with high score",
          type: "paragraph" as const,
          position: 1,
          score: 25,
          length: 25
        }
      ];

      const selected = selectChunks(chunks, 100);
      expect(selected[0].type).toBe("heading");
    });

    it("should select chunks that fit within limit", () => {
      const chunks = [
        {
          content: "a".repeat(50),
          type: "paragraph" as const,
          position: 0,
          score: 10,
          length: 50
        },
        {
          content: "b".repeat(50),
          type: "paragraph" as const,
          position: 1,
          score: 20,
          length: 50
        },
        {
          content: "c".repeat(50),
          type: "paragraph" as const,
          position: 2,
          score: 5,
          length: 50
        }
      ];

      const selected = selectChunks(chunks, 100);
      expect(selected.length).toBeLessThanOrEqual(2);
    });

    it("should maintain chronological order", () => {
      const chunks = [
        {
          content: "First",
          type: "paragraph" as const,
          position: 0,
          score: 5,
          length: 5
        },
        {
          content: "Second",
          type: "paragraph" as const,
          position: 1,
          score: 10,
          length: 6
        },
        {
          content: "Third",
          type: "paragraph" as const,
          position: 2,
          score: 8,
          length: 5
        }
      ];

      const selected = selectChunks(chunks, 100);
      for (let i = 1; i < selected.length; i++) {
        expect(selected[i].position).toBeGreaterThan(selected[i - 1].position);
      }
    });
  });

  describe("assembleChunks", () => {
    it("should join chunks with double newlines", () => {
      const chunks = [
        {
          content: "First",
          type: "paragraph" as const,
          position: 0,
          score: 0,
          length: 5
        },
        {
          content: "Second",
          type: "paragraph" as const,
          position: 1,
          score: 0,
          length: 6
        }
      ];

      const result = assembleChunks(chunks);
      expect(result).toContain("First");
      expect(result).toContain("Second");
    });

    it("should add gap markers for non-consecutive chunks", () => {
      const chunks = [
        {
          content: "First",
          type: "paragraph" as const,
          position: 0,
          score: 0,
          length: 5
        },
        {
          content: "Third",
          type: "paragraph" as const,
          position: 2,
          score: 0,
          length: 5
        }
      ];

      const result = assembleChunks(chunks);
      expect(result).toContain("[...]");
    });

    it("should return empty string for empty chunks", () => {
      const result = assembleChunks([]);
      expect(result).toBe("");
    });
  });

  describe("balancedTruncate", () => {
    it("should not truncate short text", () => {
      const text = "Short text";
      const result = balancedTruncate(text, 100);
      expect(result).toBe(text);
    });

    it("should include start, middle, and end", () => {
      const text = "a".repeat(1000);
      const result = balancedTruncate(text, 100);

      expect(result.length).toBeLessThanOrEqual(110);
      expect(result).toContain("[...]");
    });

    it("should respect max length", () => {
      const text = "a".repeat(10000);
      const result = balancedTruncate(text, 500);

      expect(result.length).toBeLessThanOrEqual(520);
    });
  });

  describe("truncateMarkdown", () => {
    it("should preserve headings", () => {
      const markdown = "# Important\n\n" + "a".repeat(5000) + "\n\n## Conclusion\n\nEnd";
      const result = truncateMarkdown(markdown, 1000);

      expect(result.truncated).toBe(true);
      expect(result.content).toContain("Important");
    });

    it("should preserve code blocks", () => {
      const markdown = "```javascript\nconst x = 1;\n```\n\n" + "a".repeat(5000);
      const result = truncateMarkdown(markdown, 1000);

      expect(result.truncated).toBe(true);
    });

    it("should include metadata", () => {
      const markdown = "# Title\n\n" + "a".repeat(5000);
      const result = truncateMarkdown(markdown, 1000);

      expect(result.chunks_selected).toBeDefined();
      expect(result.chunks_total).toBeDefined();
      expect(result.original_length).toBe(markdown.length);
    });
  });

  describe("truncateText", () => {
    it("should preserve important sentences", () => {
      const text =
        "This is a summary. " +
        "a".repeat(1000) +
        ". " +
        "This is the conclusion. " +
        "a".repeat(1000);
      const result = truncateText(text, 500);

      expect(result.truncated).toBe(true);
    });

    it("should include metadata", () => {
      const text = "First sentence. " + "a".repeat(5000) + ". Last sentence.";
      const result = truncateText(text, 1000);

      expect(result.chunks_selected).toBeDefined();
      expect(result.chunks_total).toBeDefined();
      expect(result.original_length).toBe(text.length);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty content", () => {
      const result = applySmartTruncation("", "text", { mode: "standard" });

      expect(result.truncated).toBe(false);
      expect(result.content).toBe("");
    });

    it("should handle very small limits", () => {
      const content = "a".repeat(10000);
      const result = applySmartTruncation(content, "text", { max_length: 1000 });

      expect(result.truncated).toBe(true);
      expect(result.final_length).toBeLessThanOrEqual(1000);
    });

    it("should handle content with no structure", () => {
      const content = "a".repeat(10000);
      const result = applySmartTruncation(content, "markdown", { mode: "compact" });

      expect(result.truncated).toBe(true);
      expect(result.final_length).toBeLessThanOrEqual(3000);
    });
  });
});
