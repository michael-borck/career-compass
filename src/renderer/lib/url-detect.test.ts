import { describe, it, expect } from 'vitest';
import { looksLikeUrl } from './url-detect';

describe('looksLikeUrl', () => {
  it('returns true for a plain https URL', () => {
    expect(looksLikeUrl('https://example.com/job/123')).toBe(true);
  });

  it('returns true for a plain http URL', () => {
    expect(looksLikeUrl('http://example.com')).toBe(true);
  });

  it('returns true with leading/trailing whitespace', () => {
    expect(looksLikeUrl('  https://example.com  ')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(looksLikeUrl('I want to be a data analyst')).toBe(false);
  });

  it('returns false for a URL mixed with other text', () => {
    expect(looksLikeUrl('Check https://example.com out')).toBe(false);
  });

  it('returns false for a string with multiple URLs', () => {
    expect(looksLikeUrl('https://a.com https://b.com')).toBe(false);
  });

  it('returns false for non-http protocols', () => {
    expect(looksLikeUrl('ftp://example.com')).toBe(false);
    expect(looksLikeUrl('javascript:alert(1)')).toBe(false);
    expect(looksLikeUrl('mailto:me@example.com')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(looksLikeUrl('')).toBe(false);
    expect(looksLikeUrl('   ')).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    expect(looksLikeUrl('https://')).toBe(false);
    expect(looksLikeUrl('http')).toBe(false);
    expect(looksLikeUrl('https://.com')).toBe(false);
  });

  it('returns true for URLs with query strings and fragments', () => {
    expect(looksLikeUrl('https://example.com/page?q=1&b=2#section')).toBe(true);
  });
});
