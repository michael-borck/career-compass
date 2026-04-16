import { describe, it, expect } from 'vitest';
import { buildResumeReviewPrompt, parseResumeReview } from './resume-review';

describe('buildResumeReviewPrompt', () => {
  it('includes the resume', () => {
    expect(buildResumeReviewPrompt({ resume: 'Three years at Curtin.' })).toContain('Curtin');
  });
  it('includes target when provided', () => {
    expect(buildResumeReviewPrompt({ resume: 'r', jobTitle: 'Data analyst' })).toContain('Data analyst');
  });
  it('asks for the review JSON shape', () => {
    const out = buildResumeReviewPrompt({ resume: 'r' });
    expect(out).toContain('"overallImpression"');
    expect(out).toContain('"strengths"');
    expect(out).toContain('"improvements"');
    expect(out).toContain('"keywordsToAdd"');
    expect(out).toContain('"structuralNotes"');
  });
});

describe('parseResumeReview', () => {
  const happy = JSON.stringify({
    overallImpression: 'Solid foundation with room for improvement.',
    strengths: ['Clear structure', 'Relevant experience'],
    improvements: [
      { section: 'Summary', suggestion: 'Add a target role', why: 'Focus signals intent', example: 'Aspiring data analyst with 2 years...' },
      { section: 'Skills', suggestion: 'Add SQL', why: 'Most analyst roles require it', example: 'Technical skills: Python, SQL, Tableau' },
    ],
    keywordsToAdd: ['SQL', 'data visualization'],
    structuralNotes: ['Move projects section above education'],
  });
  it('parses happy path', () => {
    const out = parseResumeReview(happy);
    expect(out.overallImpression).toContain('Solid');
    expect(out.strengths).toHaveLength(2);
    expect(out.improvements).toHaveLength(2);
    expect(out.improvements[0].section).toBe('Summary');
    expect(out.keywordsToAdd).toContain('SQL');
    expect(out.structuralNotes).toHaveLength(1);
  });
  it('strips code fences', () => {
    expect(parseResumeReview('```json\n' + happy + '\n```').overallImpression).toContain('Solid');
  });
  it('throws on missing overallImpression', () => {
    expect(() => parseResumeReview(JSON.stringify({ strengths: [], improvements: [], keywordsToAdd: [], structuralNotes: [] }))).toThrow(/overallImpression/i);
  });
  it('coerces missing arrays to empty', () => {
    const out = parseResumeReview(JSON.stringify({
      overallImpression: 'OK.',
      improvements: [{ section: 's', suggestion: 'sg', why: 'w', example: 'e' }],
    }));
    expect(out.strengths).toEqual([]);
    expect(out.keywordsToAdd).toEqual([]);
    expect(out.structuralNotes).toEqual([]);
  });
  it('throws when improvements is empty', () => {
    expect(() => parseResumeReview(JSON.stringify({ overallImpression: 'OK.', improvements: [] }))).toThrow(/improvement/i);
  });
});
