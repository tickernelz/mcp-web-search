import { describe, it, expect } from "@jest/globals";
import { wikiGetSummary, wikiGetMultiSummary } from "../src/wikipedia.js";

describe("Wikipedia Integration", () => {
  describe("Single Language Summary", () => {
    it("should fetch Wikipedia summary in English", async () => {
      const result = await wikiGetSummary("JavaScript", "en");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("lang");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("url");
      expect(result.lang).toBe("en");
      expect(result.title).toBeDefined();
      expect(result.url).toContain("wikipedia.org");
    }, 30000);

    it("should include extract and description", async () => {
      const result = await wikiGetSummary("Python", "en");

      expect(result.extract).toBeDefined();
      if (result.extract) {
        expect(typeof result.extract).toBe("string");
        expect(result.extract.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should handle non-existent pages gracefully", async () => {
      const result = await wikiGetSummary("ThisPageDefinitelyDoesNotExist12345", "en");

      expect(result).toBeDefined();
      expect(result.lang).toBe("en");
      expect(result.url).toContain("wikipedia.org");
    }, 30000);

    it("should support different languages", async () => {
      const resultEN = await wikiGetSummary("Computer", "en");
      const resultES = await wikiGetSummary("Computadora", "es");

      expect(resultEN.lang).toBe("en");
      expect(resultES.lang).toBe("es");
      expect(resultEN.url).toContain("en.wikipedia.org");
      expect(resultES.url).toContain("es.wikipedia.org");
    }, 30000);
  });

  describe("Multi-Language Summary", () => {
    it("should fetch summaries in multiple languages", async () => {
      const result = await wikiGetMultiSummary("Artificial intelligence", "en", ["en", "es", "fr"]);

      expect(result).toBeDefined();
      expect(result).toHaveProperty("baseLang");
      expect(result).toHaveProperty("base");
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("resolved");
      expect(result.baseLang).toBe("en");
      expect(result.base).toBeDefined();
    }, 30000);

    it("should include base language in items", async () => {
      const result = await wikiGetMultiSummary("Machine learning", "en", ["en", "de"]);

      expect(result.items).toHaveProperty("en");
      expect(result.items.en).toBeDefined();
      expect(result.items.en?.lang).toBe("en");
    }, 30000);

    it("should resolve titles via langlinks", async () => {
      const result = await wikiGetMultiSummary("Computer", "en", ["en", "es"]);

      expect(result.resolved).toHaveProperty("en");
      expect(result.resolved).toHaveProperty("es");
      expect(result.resolved.en.source).toBe("base");
    }, 30000);
  });
});
