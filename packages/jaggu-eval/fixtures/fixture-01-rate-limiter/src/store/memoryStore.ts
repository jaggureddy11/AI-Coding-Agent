export class MemoryStore {
  private hits = new Map<string, number[]>();

  recordHit(key: string, timestamp: number): void {
    const list = this.hits.get(key) || [];
    list.push(timestamp);
    this.hits.set(key, list);
  }

  getHits(key: string, windowMs: number, now: number): number {
    const list = this.hits.get(key) || [];
    const recent = list.filter((t) => now - t <= windowMs);
    this.hits.set(key, recent);
    return recent.length;
  }

  reset(): void {
    this.hits.clear();
  }
}

export const defaultStore = new MemoryStore();
