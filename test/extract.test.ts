import { describe, it, expect } from "@jest/globals";
import { fetchAndExtract } from "../src/extract.js";

describe("URL Content Extraction", () => {
  describe("HTML Extraction", () => {
    it("should extract content from HTML page", async () => {
      const result = await fetchAndExtract("https://example.com");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("url");
      expect(result.url).toBe("https://example.com");
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
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
    it("should return proper structure", async () => {
      const result = await fetchAndExtract("https://example.com");

      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("title");
    }, 30000);
  });
});
