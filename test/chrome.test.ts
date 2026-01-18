import { describe, it, expect, beforeAll } from "@jest/globals";
import { findChrome, ChromeNotFoundError } from "../src/chrome.js";
import { existsSync } from "fs";

describe("Chrome Detection", () => {
  it("should find Chrome executable", () => {
    const chromePath = findChrome();
    expect(chromePath).toBeDefined();
    expect(typeof chromePath).toBe("string");
    expect(chromePath.length).toBeGreaterThan(0);
  });

  it("should return existing Chrome path", () => {
    const chromePath = findChrome();
    expect(existsSync(chromePath)).toBe(true);
  });

  it("should respect CHROME_PATH env variable", () => {
    const originalPath = process.env.CHROME_PATH;
    const testPath = "/fake/chrome/path";
    process.env.CHROME_PATH = testPath;
    
    expect(() => findChrome()).toThrow(ChromeNotFoundError);
    expect(() => findChrome()).toThrow(/not found at CHROME_PATH/);
    
    process.env.CHROME_PATH = originalPath;
  });

  it("should throw ChromeNotFoundError when Chrome not found", () => {
    const originalPath = process.env.CHROME_PATH;
    process.env.CHROME_PATH = "/nonexistent/path";
    
    expect(() => findChrome()).toThrow(ChromeNotFoundError);
    
    process.env.CHROME_PATH = originalPath;
  });
});
