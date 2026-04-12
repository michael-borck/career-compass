import { describe, it, expect } from 'vitest';
import { buildCareersPrompt } from './careers';

describe('buildCareersPrompt', () => {
  it('includes resume when provided', () => {
    const out = buildCareersPrompt({ resume: 'experienced in sql' });
    expect(out).toContain('experienced in sql');
    expect(out).toContain('<resume>');
  });

  it('includes free text when provided', () => {
    const out = buildCareersPrompt({ freeText: 'i like teaching' });
    expect(out).toContain('i like teaching');
    expect(out).toContain('<additionalContext>');
  });

  it('includes job title when provided', () => {
    const out = buildCareersPrompt({ jobTitle: 'Data Analyst' });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('curious about becoming');
  });

  it('includes distilled profile when provided', () => {
    const out = buildCareersPrompt({
      distilledProfile: {
        background: 'CS student',
        interests: ['data', 'teaching'],
        skills: ['python'],
        constraints: ['remote only'],
        goals: ['data role'],
      },
    });
    expect(out).toContain('CS student');
    expect(out).toContain('data, teaching');
    expect(out).toContain('python');
    expect(out).toContain('remote only');
    expect(out).toContain('data role');
  });

  it('combines all four inputs', () => {
    const out = buildCareersPrompt({
      resume: 'R',
      freeText: 'F',
      jobTitle: 'Analyst',
      distilledProfile: {
        background: 'B',
        interests: ['I'],
        skills: ['S'],
        constraints: ['C'],
        goals: ['G'],
      },
    });
    expect(out).toContain('R');
    expect(out).toContain('F');
    expect(out).toContain('Analyst');
    expect(out).toContain('B');
  });

  it('throws when all inputs empty', () => {
    expect(() => buildCareersPrompt({})).toThrow();
  });

  it('asks for JSON output', () => {
    const out = buildCareersPrompt({ freeText: 'x' });
    expect(out).toMatch(/JSON/i);
  });
});
