import { describe, it, expect } from 'vitest';
import { buildGapAnalysisPrompt, parseGapAnalysis } from './gaps';

describe('buildGapAnalysisPrompt', () => {
  it('throws when no target is provided', () => {
    expect(() =>
      buildGapAnalysisPrompt({ resume: 'r' })
    ).toThrow();
  });

  it('throws when no profile is provided', () => {
    expect(() =>
      buildGapAnalysisPrompt({ jobTitle: 'Data Analyst' })
    ).toThrow();
  });

  it('builds with job title + resume', () => {
    const out = buildGapAnalysisPrompt({
      jobTitle: 'Data Analyst',
      resume: 'experienced in marketing',
    });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('experienced in marketing');
    expect(out).toContain('<target');
    expect(out).toContain('<profile>');
  });

  it('builds with job advert + about you', () => {
    const out = buildGapAnalysisPrompt({
      jobAdvert: 'We seek a curious data analyst...',
      aboutYou: 'I have a stats background',
    });
    expect(out).toContain('We seek a curious data analyst');
    expect(out).toContain('stats background');
  });

  it('includes distilled profile when provided', () => {
    const out = buildGapAnalysisPrompt({
      jobTitle: 'X',
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['data role'],
      },
    });
    expect(out).toContain('CS student');
    expect(out).toContain('python');
  });

  it('asks for the GapAnalysis JSON shape', () => {
    const out = buildGapAnalysisPrompt({ jobTitle: 'X', resume: 'y' });
    expect(out).toContain('summary');
    expect(out).toContain('matches');
    expect(out).toContain('gaps');
    expect(out).toContain('severity');
    expect(out).toContain('targetLevel');
    expect(out).toContain('evidenceIdeas');
    expect(out).toContain('realisticTimeline');
  });
});

describe('parseGapAnalysis', () => {
  const validRaw = JSON.stringify({
    target: 'Data Analyst',
    summary: 'You are well placed.',
    matches: ['SQL basics', 'Stats'],
    gaps: [
      {
        title: 'Intermediate SQL',
        category: 'technical',
        severity: 'critical',
        why: 'Required for the role',
        targetLevel: 'Joins, window functions, CTEs',
        currentLevel: 'Basic SELECT',
        evidenceIdeas: ['Portfolio project', 'Coursera course'],
      },
    ],
    realisticTimeline: '3-6 months',
  });

  it('parses a clean JSON response', () => {
    const g = parseGapAnalysis(validRaw);
    expect(g.target).toBe('Data Analyst');
    expect(g.gaps).toHaveLength(1);
    expect(g.gaps[0].severity).toBe('critical');
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + validRaw + '\n```';
    const g = parseGapAnalysis(wrapped);
    expect(g.target).toBe('Data Analyst');
  });

  it('coerces missing matches to empty array', () => {
    const raw = JSON.stringify({
      target: 'X',
      summary: 'y',
      gaps: [{
        title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    });
    const g = parseGapAnalysis(raw);
    expect(g.matches).toEqual([]);
  });

  it('allows nullable currentLevel', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', matches: [],
      gaps: [{
        title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    });
    const g = parseGapAnalysis(raw);
    expect(g.gaps[0].currentLevel).toBeNull();
  });

  it('throws when summary is missing', () => {
    const raw = JSON.stringify({
      target: 'X', matches: [],
      gaps: [{ title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', evidenceIdeas: ['e'] }],
      realisticTimeline: '3 months',
    });
    expect(() => parseGapAnalysis(raw)).toThrow();
  });

  it('throws when gaps array is empty', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', matches: [],
      gaps: [],
      realisticTimeline: '3 months',
    });
    expect(() => parseGapAnalysis(raw)).toThrow();
  });
});
