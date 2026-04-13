import { describe, it, expect } from 'vitest';
import { buildLearningPathPrompt, parseLearningPath } from './learningPath';
import type { GapAnalysis } from '@/lib/session-store';

describe('buildLearningPathPrompt', () => {
  it('throws when no target is provided', () => {
    expect(() => buildLearningPathPrompt({})).toThrow();
  });

  it('builds with just a job title (standalone)', () => {
    const out = buildLearningPathPrompt({ jobTitle: 'Data Analyst' });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('<target');
  });

  it('builds with a job advert', () => {
    const out = buildLearningPathPrompt({ jobAdvert: 'We need a designer who...' });
    expect(out).toContain('We need a designer');
  });

  it('includes profile when provided', () => {
    const out = buildLearningPathPrompt({
      jobTitle: 'X',
      resume: 'experienced',
      aboutYou: 'I want to switch fields',
    });
    expect(out).toContain('experienced');
    expect(out).toContain('switch fields');
  });

  it('mentions gap chain seed when provided', () => {
    const gap: GapAnalysis = {
      target: 'Data Analyst',
      summary: 's',
      matches: [],
      gaps: [{
        title: 'SQL', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', currentLevel: null, evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    };
    const out = buildLearningPathPrompt({ jobTitle: 'X', gapAnalysis: gap });
    expect(out).toContain('SQL');
    expect(out).toMatch(/prioriti[sz]e/i);
  });

  it('asks for the LearningPath JSON shape', () => {
    const out = buildLearningPathPrompt({ jobTitle: 'X' });
    expect(out).toContain('milestones');
    expect(out).toContain('weekRange');
    expect(out).toContain('activities');
    expect(out).toContain('outcome');
    expect(out).toContain('portfolioProject');
    expect(out).toContain('totalDuration');
    expect(out).toContain('caveats');
  });
});

describe('parseLearningPath', () => {
  const validRaw = JSON.stringify({
    target: 'Data Analyst',
    summary: 'A 12-week path.',
    prerequisites: ['Basic computer literacy'],
    milestones: [
      {
        weekRange: 'Weeks 1-2',
        focus: 'Python basics',
        activities: ['Complete a course', 'Build a small script'],
        outcome: 'Comfortable with Python syntax',
      },
    ],
    portfolioProject: 'Build a dashboard',
    totalDuration: '12 weeks',
    caveats: ['AI-generated suggestions'],
  });

  it('parses a clean JSON response', () => {
    const p = parseLearningPath(validRaw);
    expect(p.target).toBe('Data Analyst');
    expect(p.milestones).toHaveLength(1);
    expect(p.milestones[0].activities).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + validRaw + '\n```';
    const p = parseLearningPath(wrapped);
    expect(p.target).toBe('Data Analyst');
  });

  it('coerces missing optional fields to defaults', () => {
    const raw = JSON.stringify({
      target: 'X',
      summary: 'y',
      milestones: [{
        weekRange: 'W1', focus: 'f', activities: ['a'], outcome: 'o',
      }],
      totalDuration: '4 weeks',
    });
    const p = parseLearningPath(raw);
    expect(p.prerequisites).toEqual([]);
    expect(p.caveats).toEqual([]);
    expect(p.portfolioProject).toBe('');
  });

  it('throws when milestones is missing', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', totalDuration: '4 weeks',
    });
    expect(() => parseLearningPath(raw)).toThrow();
  });

  it('throws when milestones is empty', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', milestones: [], totalDuration: '4 weeks',
    });
    expect(() => parseLearningPath(raw)).toThrow();
  });
});
