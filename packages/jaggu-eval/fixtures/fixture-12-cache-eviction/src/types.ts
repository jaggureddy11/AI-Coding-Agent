export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt: number; // epoch ms
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}
