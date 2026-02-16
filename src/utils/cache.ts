import { CACHE_TTL_MS } from "../constants.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), CACHE_TTL_MS);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

export const searchCache = new MemoryCache<unknown>();
export const fetchCache = new MemoryCache<unknown>();

export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(":")}`;
}
