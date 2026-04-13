import { describe, it, expect } from 'vitest';
import { applyIntent } from './search-intent';

describe('applyIntent', () => {
  it('returns the query unchanged for general intent', () => {
    expect(applyIntent('data analyst salary', 'general')).toBe('data analyst salary');
  });

  it('appends salary site filters for salary intent', () => {
    const out = applyIntent('data analyst Perth', 'salary');
    expect(out).toContain('data analyst Perth');
    expect(out).toContain('site:glassdoor.com');
    expect(out).toContain('site:levels.fyi');
    expect(out).toContain('site:seek.com.au');
    expect(out).toContain('OR');
  });

  it('appends course site filters for course intent', () => {
    const out = applyIntent('intermediate SQL', 'course');
    expect(out).toContain('intermediate SQL');
    expect(out).toContain('site:coursera.org');
    expect(out).toContain('site:edx.org');
    expect(out).toContain('site:udemy.com');
  });

  it('appends company site filters for company intent', () => {
    const out = applyIntent('Acme Corp', 'company');
    expect(out).toContain('Acme Corp');
    expect(out).toContain('site:linkedin.com/company');
    expect(out).toContain('site:crunchbase.com');
  });

  it('handles empty query without crashing', () => {
    const out = applyIntent('', 'salary');
    expect(out).toContain('site:glassdoor.com');
  });

  it('wraps filters in parentheses', () => {
    const out = applyIntent('test', 'salary');
    expect(out).toContain('(site:');
    expect(out).toContain(')');
  });
});
