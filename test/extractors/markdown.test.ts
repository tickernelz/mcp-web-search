import { describe, it, expect } from "@jest/globals";
import { htmlToMarkdown } from "../../src/extractors/markdown.js";

describe("Markdown Converter", () => {
  it("should convert HTML to markdown", () => {
    const html = "<h1>Hello World</h1><p>This is a test.</p>";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBeDefined();
    expect(markdown).toContain("# Hello World");
    expect(markdown).toContain("This is a test.");
  });

  it("should handle code blocks", () => {
    const html = "<pre><code>const x = 1;</code></pre>";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBeDefined();
    expect(markdown).toContain("```");
    expect(markdown).toContain("const x = 1;");
  });

  it("should handle lists", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBeDefined();
    expect(markdown).toContain("Item 1");
    expect(markdown).toContain("Item 2");
    expect(markdown).toMatch(/-\s+Item 1/);
    expect(markdown).toMatch(/-\s+Item 2/);
  });

  it("should handle links", () => {
    const html = '<a href="https://example.com">Example</a>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBeDefined();
    expect(markdown).toContain("[Example](https://example.com)");
  });

  it("should return null for empty HTML", () => {
    const markdown = htmlToMarkdown("");
    expect(markdown).toBeNull();
  });

  it("should return null for whitespace only", () => {
    const markdown = htmlToMarkdown("   \n  \t  ");
    expect(markdown).toBeNull();
  });

  it("should handle malformed HTML gracefully", () => {
    const html = "<div><p>Unclosed paragraph";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBeDefined();
    expect(markdown).toContain("Unclosed paragraph");
  });

  it("should remove empty elements", () => {
    const html = "<div></div><p>Content</p><span></span>";
    const markdown = htmlToMarkdown(html);

    expect(markdown).toBeDefined();
    expect(markdown).toContain("Content");
    expect(markdown?.split("\n").filter(l => l.trim()).length).toBeLessThanOrEqual(2);
  });
});
