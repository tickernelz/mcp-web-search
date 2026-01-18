import { describe, it, expect } from "@jest/globals";
import { runTwoTierSearch } from "../src/engines.js";

describe("Search Engines", () => {
  describe("Fast Mode (DuckDuckGo)", () => {
    it("should return results from DuckDuckGo HTML", async () => {
      const result = await runTwoTierSearch({
        q: "nodejs",
        limit: 5,
        lang: "en",
        mode: "fast"
      });

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.length).toBeLessThanOrEqual(5);
      expect(result.modeUsed).toBe("fast");
      expect(result.enginesUsed).toContain("ddg_html");
      expect(result.escalated).toBe(false);
    });

    it("should return items with correct structure", async () => {
      const result = await runTwoTierSearch({
        q: "typescript",
        limit: 3,
        mode: "fast"
      });

      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("source");
      expect(item.source).toBe("ddg_html");
      expect(typeof item.title).toBe("string");
      expect(typeof item.url).toBe("string");
      expect(item.url).toMatch(/^https?:\/\//);
    });
  });

  describe("Deep Mode (Puppeteer/Bing)", () => {
    it("should return results from Bing via Puppeteer", async () => {
      const result = await runTwoTierSearch({
        q: "javascript",
        limit: 5,
        lang: "en",
        mode: "deep"
      });

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.modeUsed).toBe("deep");
      expect(result.enginesUsed).toContain("bing_puppeteer");
      expect(result.escalated).toBe(false);
    }, 60000);

    it("should return items with correct source", async () => {
      const result = await runTwoTierSearch({
        q: "python",
        limit: 3,
        mode: "deep"
      });

      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      expect(item.source).toBe("bing_puppeteer");
    }, 60000);
  });

  describe("Auto Mode", () => {
    it("should start with fast mode", async () => {
      const result = await runTwoTierSearch({
        q: "popular programming language",
        limit: 10,
        mode: "auto"
      });

      expect(result.modeUsed).toBe("auto");
      expect(result.enginesUsed).toContain("ddg_html");
    });

    it("should escalate to deep if fast results insufficient", async () => {
      const result = await runTwoTierSearch({
        q: "xyzabc123nonexistentquery456",
        limit: 10,
        mode: "auto"
      });

      expect(result.modeUsed).toBe("auto");
      if (result.escalated) {
        expect(result.enginesUsed).toContain("ddg_html");
        expect(result.enginesUsed).toContain("bing_puppeteer");
      }
    }, 60000);
  });

  describe("Limit Parameter", () => {
    it("should respect limit parameter", async () => {
      const result = await runTwoTierSearch({
        q: "web development",
        limit: 3,
        mode: "fast"
      });

      expect(result.items.length).toBeLessThanOrEqual(3);
    });

    it("should clamp limit to maximum 50", async () => {
      const result = await runTwoTierSearch({
        q: "software",
        limit: 100,
        mode: "fast"
      });

      expect(result.items.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Language Parameter", () => {
    it("should accept language parameter", async () => {
      const result = await runTwoTierSearch({
        q: "nodejs tutorial",
        limit: 5,
        lang: "en",
        mode: "fast"
      });

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });
  });
});
