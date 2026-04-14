import { describe, it, expect } from 'vitest';
import { buildSeedSuggestionPrompt, parseSeedSuggestion } from './odyssey-suggest';

describe('buildSeedSuggestionPrompt', () => {
  it('uses different framing for each life type', () => {
    const current = buildSeedSuggestionPrompt({ type: 'current' });
    const pivot = buildSeedSuggestionPrompt({ type: 'pivot' });
    const wildcard = buildSeedSuggestionPrompt({ type: 'wildcard' });
    expect(current).toMatch(/current trajectory|natural progression/i);
    expect(pivot).toMatch(/pivot|alternative/i);
    expect(wildcard).toMatch(/wildcard|money, image/i);
    expect(current).not.toBe(pivot);
    expect(pivot).not.toBe(wildcard);
  });

  it('asks for the JSON shape', () => {
    const out = buildSeedSuggestionPrompt({ type: 'current' });
    expect(out).toMatch(/"label"/);
    expect(out).toMatch(/"description"/);
  });

  it('includes profile text when provided', () => {
    const out = buildSeedSuggestionPrompt({
      type: 'pivot',
      resume: 'Third-year nursing student.',
    });
    expect(out).toContain('nursing student');
  });

  it('includes distilled profile when provided', () => {
    const out = buildSeedSuggestionPrompt({
      type: 'pivot',
      distilledProfile: {
        background: 'Nursing undergrad',
        interests: ['public health'],
        skills: ['patient communication'],
        constraints: [],
        goals: ['work in community health'],
      },
    });
    expect(out).toMatch(/nursing undergrad/i);
    expect(out).toMatch(/public health/i);
  });
});

describe('parseSeedSuggestion', () => {
  it('parses valid JSON', () => {
    const raw = '{"label":"Health data analyst","description":"I work for a small health nonprofit."}';
    expect(parseSeedSuggestion(raw)).toEqual({
      label: 'Health data analyst',
      description: 'I work for a small health nonprofit.',
    });
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"label":"A","description":"B"}\n```';
    expect(parseSeedSuggestion(raw)).toEqual({ label: 'A', description: 'B' });
  });

  it('throws when label is missing', () => {
    expect(() => parseSeedSuggestion('{"description":"B"}')).toThrow(/label/);
  });

  it('throws when description is missing', () => {
    expect(() => parseSeedSuggestion('{"label":"A"}')).toThrow(/description/);
  });

  it('throws when label is empty', () => {
    expect(() => parseSeedSuggestion('{"label":"","description":"B"}')).toThrow(/label/);
  });
});
