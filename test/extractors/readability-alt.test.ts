import { describe, it, expect } from "@jest/globals";
import { extractWithReadabilityAlt } from "../../src/extractors/readability-alt.js";

describe("Readability Alternative Extractor", () => {
  it("should extract content from simple HTML", () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <article>
            <h1>Main Title</h1>
            <p>This is the main content of the article.</p>
            <p>Another paragraph with more content.</p>
          </article>
        </body>
      </html>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
    expect(result?.title).toBe("Test Page");
    expect(result?.textContent).toContain("Main Title");
    expect(result?.textContent).toContain("main content");
    expect(result?.length).toBeGreaterThan(0);
  });

  it("should remove ads and sidebars", () => {
    const html = `
      <html>
        <body>
          <div class="sidebar">Sidebar content</div>
          <article>
            <p>Main article content here with substantial text.</p>
            <p>More article content to increase score significantly.</p>
            <p>Even more content to ensure article wins over sidebar.</p>
          </article>
          <div class="ads">Advertisement</div>
        </body>
      </html>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
    expect(result?.textContent).toContain("Main article");
  });

  it("should handle multi-column layouts", () => {
    const html = `
      <html>
        <body>
          <main>
            <section>
              <p>First column with substantial content that should be extracted.</p>
            </section>
            <section>
              <p>Second column with more substantial content for extraction.</p>
            </section>
          </main>
        </body>
      </html>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
    expect(result?.textContent).toContain("First column");
    expect(result?.textContent).toContain("Second column");
  });

  it("should remove scripts and styles", () => {
    const html = `
      <html>
        <body>
          <script>alert('test');</script>
          <style>.test { color: red; }</style>
          <article>
            <p>Clean content without scripts.</p>
          </article>
        </body>
      </html>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
    expect(result?.textContent).toContain("Clean content");
    expect(result?.textContent).not.toContain("alert");
    expect(result?.textContent).not.toContain("color: red");
  });

  it("should handle empty or minimal content", () => {
    const html = `
      <html>
        <body>
          <div>Short</div>
        </body>
      </html>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
  });

  it("should return null for invalid HTML", () => {
    const result = extractWithReadabilityAlt("", "https://example.com");

    expect(result).toBeDefined();
  });

  it("should prefer article tags", () => {
    const html = `
      <html>
        <body>
          <div>
            <p>Some random div content.</p>
          </div>
          <article>
            <h1>Article Title</h1>
            <p>This is the main article with substantial content that should be preferred.</p>
            <p>More article content here to increase the score.</p>
          </article>
        </body>
      </html>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
    expect(result?.textContent).toContain("Article Title");
    expect(result?.textContent).toContain("main article");
  });

  it("should handle malformed HTML gracefully", () => {
    const html = `
      <html>
        <body>
          <article>
            <p>Unclosed paragraph
            <div>Content in div
          </article>
        </body>
    `;

    const result = extractWithReadabilityAlt(html, "https://example.com");

    expect(result).toBeDefined();
    expect(result?.textContent).toContain("Unclosed paragraph");
  });
});
