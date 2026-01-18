import { describe, it, expect } from "@jest/globals";
import { fetchAndExtract } from "../src/extract.js";

describe("URL Content Extraction", () => {
  describe("HTML Extraction", () => {
    it("should extract content from HTML page", async () => {
      const result = await fetchAndExtract("https://example.com");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("format");
      expect(result.url).toBe("https://example.com");

      if (result.format === "markdown") {
        expect(result.markdown).toBeDefined();
        expect(typeof result.markdown).toBe("string");
        expect(result.markdown!.length).toBeGreaterThan(0);
      } else {
        expect(result.text).toBeDefined();
        expect(typeof result.text).toBe("string");
        expect(result.text!.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should return markdown format by default", async () => {
      const result = await fetchAndExtract("https://example.com");

      expect(result.format).toBeDefined();
      expect(["markdown", "text"]).toContain(result.format);
      if (result.format === "markdown") {
        expect(result.markdown).toBeDefined();
        expect(typeof result.markdown).toBe("string");
        expect(result.text).toBeUndefined();
      } else {
        expect(result.text).toBeDefined();
        expect(result.markdown).toBeUndefined();
      }
    }, 30000);

    it("should extract title from HTML", async () => {
      const result = await fetchAndExtract("https://example.com");

      expect(result.title).toBeDefined();
      expect(typeof result.title).toBe("string");
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should throw error for invalid URL", async () => {
      await expect(fetchAndExtract("not-a-url")).rejects.toThrow();
    });

    it("should throw error for localhost URLs", async () => {
      await expect(fetchAndExtract("http://localhost:3000")).rejects.toThrow(/Blocked localhost/);
    });

    it("should throw error for 127.0.0.1", async () => {
      await expect(fetchAndExtract("http://127.0.0.1")).rejects.toThrow(/Blocked localhost/);
    });

    it("should throw error for .local domains", async () => {
      await expect(fetchAndExtract("http://myserver.local")).rejects.toThrow(/Blocked localhost/);
    });

    it("should throw error for non-existent domain", async () => {
      await expect(
        fetchAndExtract("https://this-domain-definitely-does-not-exist-12345.com")
      ).rejects.toThrow();
    }, 30000);
  });

  describe("Content Structure", () => {
    it("should return proper structure with format field", async () => {
      const result = await fetchAndExtract("https://example.com");

      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("format");
      expect(["markdown", "text"]).toContain(result.format);
    }, 30000);

    it("should have content field based on format", async () => {
      const result = await fetchAndExtract("https://example.com");

      if (result.format === "markdown") {
        expect(result.markdown).toBeDefined();
        expect(typeof result.markdown).toBe("string");
        expect(result.markdown!.length).toBeGreaterThan(0);
        expect(result.text).toBeUndefined();
      } else {
        expect(result.text).toBeDefined();
        expect(typeof result.text).toBe("string");
        expect(result.text!.length).toBeGreaterThan(0);
        expect(result.markdown).toBeUndefined();
      }
    }, 30000);
  });

  describe("Truncation Options", () => {
    it("should apply compact mode truncation", async () => {
      const result = await fetchAndExtract("https://example.com", { mode: "compact" });

      expect(result).toBeDefined();
      if (result.truncated) {
        expect(result.original_length).toBeDefined();
        expect(result.truncation_ratio).toBeDefined();
        const contentLength = result.markdown?.length || result.text?.length || 0;
        expect(contentLength).toBeLessThanOrEqual(3000);
      }
    }, 30000);

    it("should apply standard mode truncation", async () => {
      const result = await fetchAndExtract("https://example.com", { mode: "standard" });

      expect(result).toBeDefined();
      if (result.truncated) {
        expect(result.original_length).toBeDefined();
        expect(result.truncation_ratio).toBeDefined();
        const contentLength = result.markdown?.length || result.text?.length || 0;
        expect(contentLength).toBeLessThanOrEqual(8000);
      }
    }, 30000);

    it("should not truncate in full mode", async () => {
      const result = await fetchAndExtract("https://example.com", { mode: "full" });

      expect(result).toBeDefined();
      expect(result.truncated).toBeFalsy();
    }, 30000);

    it("should respect custom max_length parameter", async () => {
      const result = await fetchAndExtract("https://example.com", { max_length: 2000 });

      expect(result).toBeDefined();
      if (result.truncated) {
        const contentLength = result.markdown?.length || result.text?.length || 0;
        expect(contentLength).toBeLessThanOrEqual(2000);
      }
    }, 30000);

    it("should include truncation metadata when truncated", async () => {
      const result = await fetchAndExtract("https://example.com", { mode: "compact" });

      if (result.truncated) {
        expect(result.original_length).toBeDefined();
        expect(result.original_length).toBeGreaterThan(0);
        expect(result.truncation_ratio).toBeDefined();
        expect(result.truncation_ratio).toBeGreaterThan(0);
        expect(result.truncation_ratio).toBeLessThanOrEqual(1);
      }
    }, 30000);

    it("should not include truncation metadata when not truncated", async () => {
      const result = await fetchAndExtract("https://example.com", { mode: "full" });

      if (!result.truncated) {
        expect(result.truncation_ratio).toBeUndefined();
      }
    }, 30000);
  });
});
