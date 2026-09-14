import type { CacheEntry, CacheStats } from './types.ts';

export class MemoryCache<T = unknown> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    this.store.set(key, {
      key,
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Defect: Checks expiry and returns undefined on expiry, but NEVER deletes the key
   * from this.store. Over time, expired items accumulate and leak memory!
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      // Memory leak: misses incremented, undefined returned, but entry remains retained in map!
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiresAt;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Returns the count of entries actually stored in memory.
   * If eviction is working, expired entries should not count towards retained size.
   */
  getRetainedSize(): number {
    return this.store.size;
  }

  getStats(): CacheStats {
    return {
      size: this.getRetainedSize(),
      hits: this.hits,
      misses: this.misses,
    };
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
