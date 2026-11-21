import type { SourceRef } from './prompt';

type CacheEntry = {
  results: SourceRef[];
  timestamp: number;
};

const MAX_ENTRIES = 50;
/** Search results go stale quickly (salaries, courses, hiring pages). */
export const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function makeKey(engine: string, query: string): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${engine}::${normalized}`;
}

export function getCached(key: string): SourceRef[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= SEARCH_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
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
