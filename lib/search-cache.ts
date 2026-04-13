import type { SourceRef } from './session-store';

type CacheEntry = {
  results: SourceRef[];
  timestamp: number;
};

const MAX_ENTRIES = 50;
const cache = new Map<string, CacheEntry>();

export function makeKey(engine: string, query: string): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${engine}::${normalized}`;
}

export function getCached(key: string): SourceRef[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry);
  return entry.results;
}

export function setCached(key: string, results: SourceRef[]): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { results, timestamp: Date.now() });
}

// Test-only helper.
export function __resetCacheForTests(): void {
  cache.clear();
}
