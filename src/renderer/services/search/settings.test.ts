import { describe, it, expect } from 'vitest';
import {
  isSearchConfigured,
  normaliseEngine,
  type SearchSettings,
} from './settings';

function makeSettings(partial: Partial<SearchSettings>): SearchSettings {
  return { engine: 'duckduckgo', apiKey: '', url: '', ...partial };
}

describe('isSearchConfigured', () => {
  it('returns false when engine is disabled', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'disabled' }))).toBe(false);
  });

  it('returns true for duckduckgo regardless of keys', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'duckduckgo' }))).toBe(true);
  });

  it('returns false for brave without an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'brave', apiKey: '' }))).toBe(false);
  });

  it('returns true for brave with an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'brave', apiKey: 'k' }))).toBe(true);
  });

  it('returns false for serper without an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'serper' }))).toBe(false);
  });

  it('returns true for serper with an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'serper', apiKey: 'k' }))).toBe(true);
  });

  it('returns false for searxng without a URL', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'searxng' }))).toBe(false);
  });

  it('returns true for searxng with a URL', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'searxng', url: 'http://x' }))).toBe(true);
  });
});

describe('normaliseEngine', () => {
  it('migrates the retired bing engine to duckduckgo', () => {
    expect(normaliseEngine('bing')).toBe('duckduckgo');
  });

  it('keeps a valid engine', () => {
    expect(normaliseEngine('brave')).toBe('brave');
  });

  it('falls back to duckduckgo for an unknown engine', () => {
    expect(normaliseEngine('altavista')).toBe('duckduckgo');
    expect(normaliseEngine(undefined)).toBe('duckduckgo');
  });
});
