import { describe, it, expect } from 'vitest';
import { buildBoardPrompt, parseBoardReview } from './board';

describe('buildBoardPrompt', () => {
  const base = {
    framing: '',
    focusRole: null,
    resume: 'Third-year public health student at Curtin.',
  };

  it('includes all four advisor personas', () => {
    const out = buildBoardPrompt(base);
    expect(out).toMatch(/The Recruiter/);
    expect(out).toMatch(/The HR Partner/);
    expect(out).toMatch(/The Hiring Manager/);
    expect(out).toMatch(/The Mentor/);
  });

  it('asks for the voices + synthesis JSON shape', () => {
    const out = buildBoardPrompt(base);
    expect(out).toMatch(/"voices"/);
    expect(out).toMatch(/"synthesis"/);
    expect(out).toMatch(/"agreements"/);
    expect(out).toMatch(/"disagreements"/);
    expect(out).toMatch(/"topPriorities"/);
    for (const role of ['recruiter', 'hr', 'manager', 'mentor']) {
      expect(out).toContain(`"${role}"`);
    }
  });

  it('includes profile when provided', () => {
    const out = buildBoardPrompt(base);
    expect(out).toContain('Curtin');
  });

  it('includes framing block when framing is non-empty', () => {
    const out = buildBoardPrompt({ ...base, framing: 'I feel too academic for industry.' });
    expect(out).toContain('<framing>');
    expect(out).toContain('I feel too academic for industry.');
  });

  it('omits framing block when framing is empty', () => {
    const out = buildBoardPrompt({ ...base, framing: '' });
    expect(out).not.toContain('<framing>');
  });

  it('omits framing block when framing is whitespace-only', () => {
    const out = buildBoardPrompt({ ...base, framing: '   ' });
    expect(out).not.toContain('<framing>');
  });

  it('includes focus role block when non-null', () => {
    const out = buildBoardPrompt({ ...base, focusRole: 'Graduate data analyst' });
    expect(out).toContain('<focusRole>');
    expect(out).toContain('Graduate data analyst');
  });

  it('omits focus role block when null', () => {
    const out = buildBoardPrompt(base);
    expect(out).not.toContain('<focusRole>');
  });

  it('includes distilled profile when provided', () => {
    const out = buildBoardPrompt({
      framing: '',
      focusRole: null,
      distilledProfile: {
        background: 'Nursing undergrad',
        interests: ['public health'],
        skills: ['patient communication'],
        constraints: [],
        goals: ['community health role'],
      },
    });
    expect(out).toMatch(/nursing undergrad/i);
    expect(out).toMatch(/public health/i);
  });

  it('includes jobAdvert when provided', () => {
    const out = buildBoardPrompt({
      framing: '',
      focusRole: null,
      resume: 'r',
      jobAdvert: 'We are hiring a Graduate Analyst...',
    });
    expect(out).toContain('Graduate Analyst');
  });
});

describe('parseBoardReview', () => {
  const happyPath = JSON.stringify({
    voices: [
      { role: 'recruiter', name: 'The Recruiter', response: 'Your resume needs keywords.' },
      { role: 'hr', name: 'The HR Partner', response: 'Culture fit seems strong.' },
      { role: 'manager', name: 'The Hiring Manager', response: 'I would probe your projects.' },
      { role: 'mentor', name: 'The Mentor', response: 'You have real curiosity.' },
    ],
    synthesis: {
      agreements: ['Strong curiosity signals'],
      disagreements: ['The Recruiter wants more keywords, but The Mentor sees depth'],
      topPriorities: ['Add concrete project outcomes', 'Reframe academic work in industry language'],
    },
  });

  it('parses happy path into voices + synthesis', () => {
    const out = parseBoardReview(happyPath);
    expect(out.voices).toHaveLength(4);
    expect(out.voices.map((v) => v.role)).toEqual(['recruiter', 'hr', 'manager', 'mentor']);
    expect(out.synthesis.agreements).toEqual(['Strong curiosity signals']);
    expect(out.synthesis.topPriorities).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const out = parseBoardReview('```json\n' + happyPath + '\n```');
    expect(out.voices).toHaveLength(4);
  });

  it('coerces voice order to canonical recruiter/hr/manager/mentor', () => {
    const scrambled = JSON.stringify({
      voices: [
        { role: 'mentor', name: 'The Mentor', response: 'me' },
        { role: 'manager', name: 'The Hiring Manager', response: 'ma' },
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
      ],
      synthesis: { agreements: ['x'], disagreements: [], topPriorities: [] },
    });
    const out = parseBoardReview(scrambled);
    expect(out.voices.map((v) => v.role)).toEqual(['recruiter', 'hr', 'manager', 'mentor']);
    expect(out.voices[0].response).toBe('r');
    expect(out.voices[3].response).toBe('me');
  });

  it('throws when a role is missing', () => {
    const broken = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
      ],
      synthesis: { agreements: ['x'], disagreements: [], topPriorities: [] },
    });
    expect(() => parseBoardReview(broken)).toThrow(/mentor/i);
  });

  it('throws when a voice response is empty', () => {
    const broken = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: '' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: ['x'], disagreements: [], topPriorities: [] },
    });
    expect(() => parseBoardReview(broken)).toThrow(/response/i);
  });

  it('coerces missing synthesis arrays to empty arrays', () => {
    const minimal = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: ['a'] },
    });
    const out = parseBoardReview(minimal);
    expect(out.synthesis.disagreements).toEqual([]);
    expect(out.synthesis.topPriorities).toEqual([]);
  });

  it('throws when all three synthesis arrays are empty', () => {
    const broken = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: [], disagreements: [], topPriorities: [] },
    });
    expect(() => parseBoardReview(broken)).toThrow(/synthesis/i);
  });
});
