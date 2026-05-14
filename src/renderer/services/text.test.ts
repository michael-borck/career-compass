import { describe, it, expect } from 'vitest';
import { normalizeText } from './text';

describe('normalizeText', () => {
  it('collapses runs of whitespace to single spaces', () => {
    expect(normalizeText('a   b\t\tc')).toBe('a b c');
  });
  it('collapses runs of newlines to single newlines', () => {
    expect(normalizeText('a\n\n\nb')).toBe('a b');
  });
  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });
  it('handles empty input', () => {
    expect(normalizeText('')).toBe('');
  });
});
