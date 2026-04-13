import { describe, it, expect } from 'vitest';
import { buildContextBlock } from './context-block';

describe('buildContextBlock', () => {
  it('returns null when all inputs are empty', () => {
    expect(buildContextBlock()).toBeNull();
    expect(buildContextBlock(null, '', '', '')).toBeNull();
    expect(buildContextBlock('   ', '   ', '   ', '   ')).toBeNull();
  });

  it('includes resume when provided', () => {
    const out = buildContextBlock('my resume text');
    expect(out).toContain('RESUME');
    expect(out).toContain('my resume text');
  });

  it('includes free text when provided', () => {
    const out = buildContextBlock(null, 'about me');
    expect(out).toContain('BACKGROUND');
    expect(out).toContain('about me');
  });

  it('includes job title when provided', () => {
    const out = buildContextBlock(null, '', 'Data Analyst');
    expect(out).toContain('JOB OF INTEREST');
    expect(out).toContain('Data Analyst');
  });

  it('includes job advert when provided', () => {
    const out = buildContextBlock(null, '', '', 'We are hiring...');
    expect(out).toContain('JOB ADVERT');
    expect(out).toContain('We are hiring');
  });

  it('includes a distilled profile when provided', () => {
    const out = buildContextBlock(null, '', '', '', {
      background: 'CS student',
      interests: ['data'],
      skills: ['python'],
      constraints: [],
      goals: ['data role'],
    });
    expect(out).toContain('CS student');
    expect(out).toContain('python');
    expect(out).toContain('data role');
  });

  it('combines multiple inputs', () => {
    const out = buildContextBlock('R', 'F', 'T', 'A');
    expect(out).toContain('R');
    expect(out).toContain('F');
    expect(out).toContain('T');
    expect(out).toContain('A');
  });

  it('returns the disambiguation hint phrase', () => {
    const out = buildContextBlock('r');
    expect(out).toContain('you CAN read it');
    expect(out).toContain('the resume');
  });
});
