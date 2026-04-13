import { describe, it, expect } from 'vitest';
import { formatSourcesForFootnote, formatSourcesForInlineCite } from './search-prompt';
import type { SourceRef } from './session-store';

const sources: SourceRef[] = [
  { title: 'Glassdoor — Data Analyst', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
  { title: 'Levels.fyi Data Analyst', url: 'https://levels.fyi/x', domain: 'levels.fyi' },
];

describe('formatSourcesForFootnote', () => {
  it('returns empty string for empty sources', () => {
    expect(formatSourcesForFootnote([])).toBe('');
  });

  it('includes all sources numbered', () => {
    const out = formatSourcesForFootnote(sources);
    expect(out).toContain('[1] Glassdoor — Data Analyst (glassdoor.com)');
    expect(out).toContain('[2] Levels.fyi Data Analyst (levels.fyi)');
    expect(out).toContain('https://glassdoor.com/x');
  });

  it('wraps in a <sources> block', () => {
    const out = formatSourcesForFootnote(sources);
    expect(out).toContain('<sources>');
    expect(out).toContain('</sources>');
  });

  it('does NOT include inline marker instruction', () => {
    const out = formatSourcesForFootnote(sources);
    expect(out).not.toMatch(/add the source number as an inline marker/i);
  });
});

describe('formatSourcesForInlineCite', () => {
  it('returns empty string for empty sources', () => {
    expect(formatSourcesForInlineCite([])).toBe('');
  });

  it('includes all sources numbered', () => {
    const out = formatSourcesForInlineCite(sources);
    expect(out).toContain('[1] Glassdoor — Data Analyst');
    expect(out).toContain('[2] Levels.fyi Data Analyst');
  });

  it('includes the inline marker instruction', () => {
    const out = formatSourcesForInlineCite(sources);
    expect(out).toMatch(/inline marker/i);
    expect(out).toMatch(/\[1\] or \[2\]/);
  });

  it('wraps in a <sources> block', () => {
    const out = formatSourcesForInlineCite(sources);
    expect(out).toContain('<sources>');
  });
});
