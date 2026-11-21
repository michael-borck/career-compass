import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCached, setCached, makeKey, __resetCacheForTests, SEARCH_CACHE_TTL_MS } from './cache';
import type { SourceRef } from './prompt';

const sampleResults: SourceRef[] = [
  { title: 'Example', url: 'https://example.com', domain: 'example.com' },
];

describe('makeKey', () => {
  it('produces the same key for differently-cased queries', () => {
    expect(makeKey('duckduckgo', 'Data Analyst')).toBe(makeKey('duckduckgo', 'data analyst'));
  });

  it('produces the same key for differently-whitespaced queries', () => {
    expect(makeKey('duckduckgo', '  data   analyst  ')).toBe(makeKey('duckduckgo', 'data analyst'));
  });

  it('produces different keys per engine', () => {
    expect(makeKey('duckduckgo', 'q')).not.toBe(makeKey('brave', 'q'));
  });
});

describe('getCached / setCached', () => {
  beforeEach(() => {
    __resetCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires entries after the TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setCached('ttl', sampleResults);
    vi.advanceTimersByTime(SEARCH_CACHE_TTL_MS - 1);
    expect(getCached('ttl')).toEqual(sampleResults);
    vi.advanceTimersByTime(2);
    expect(getCached('ttl')).toBeNull();
  });

  it('returns null for a cache miss', () => {
    expect(getCached('missing')).toBeNull();
  });

  it('returns stored results for a cache hit', () => {
    setCached('hit', sampleResults);
    expect(getCached('hit')).toEqual(sampleResults);
  });

  it('evicts the oldest entry when over the 50-entry limit', () => {
    for (let i = 0; i < 50; i++) {
      setCached(`key-${i}`, sampleResults);
    }
    setCached('key-new', sampleResults);
    expect(getCached('key-0')).toBeNull();
    expect(getCached('key-new')).toEqual(sampleResults);
  });

  it('refreshes LRU position on cache hit', () => {
    for (let i = 0; i < 50; i++) {
      setCached(`key-${i}`, sampleResults);
    }
    // Touch key-0 so it becomes most recent
    getCached('key-0');
    // Insert a new one; key-1 should now be the oldest and evicted
    setCached('key-new', sampleResults);
    expect(getCached('key-0')).toEqual(sampleResults);
    expect(getCached('key-1')).toBeNull();
  });
});
