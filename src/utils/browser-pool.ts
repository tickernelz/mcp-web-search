import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import { findChrome } from "../chrome.js";
import { PUPPETEER_ARGS, PUPPETEER_TIMEOUT } from "../constants.js";

class BrowserPool {
  private browser: Browser | null = null;
  private launching = false;
  private waitQueue: Array<(browser: Browser) => void> = [];

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (this.launching) {
      return new Promise(resolve => {
        this.waitQueue.push(resolve);
      });
    }

    this.launching = true;
    try {
      const chromePath = findChrome();
      this.browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: PUPPETEER_ARGS
      });

      this.browser.on("disconnected", () => {
        this.browser = null;
      });

      for (const resolve of this.waitQueue) {
        resolve(this.browser);
      }
      this.waitQueue = [];

      return this.browser;
    } finally {
      this.launching = false;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
    const browser = await this.getBrowser();
    return fn(browser);
  }
}

export const browserPool = new BrowserPool();
