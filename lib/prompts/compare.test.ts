import { describe, it, expect } from 'vitest';
import { buildComparePrompt, parseComparison, type CompareInput } from './compare';
import type { finalCareerInfo } from '@/lib/types';

const baseQuick: CompareInput = {
  mode: 'quick',
  targets: [
    { label: 'Data analyst' },
    { label: 'UX researcher' },
  ],
};

const richCareer: finalCareerInfo = {
  jobTitle: 'Data analyst',
  jobDescription: 'Turns raw data into useful findings.',
  timeline: '3-6 months',
  salary: '$75-95k AUD',
  difficulty: 'Medium',
  workRequired: 'SQL, Python basics, Tableau.',
  aboutTheRole: 'Works with small research teams on survey data.',
  whyItsagoodfit: ['Likes numbers'],
  roadmap: [{ step1: 'Learn SQL' }],
};

describe('buildComparePrompt', () => {
  it('includes all target labels', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).toContain('Data analyst');
    expect(out).toContain('UX researcher');
  });

  it('asks for the seven-dimension cells shape', () => {
    const out = buildComparePrompt(baseQuick);
    for (const dim of ['typicalDay', 'coreSkills', 'trainingNeeded', 'salaryRange', 'workSetting', 'whoItSuits', 'mainChallenge']) {
      expect(out).toContain(`"${dim}"`);
    }
  });

  it('asks for roles as a JSON array', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).toMatch(/"roles"/);
    expect(out).toMatch(/"label"/);
    expect(out).toMatch(/"cells"/);
  });

  it('quick mode does not embed finalCareerInfo context', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).not.toContain('Existing career data');
  });

  it('rich mode embeds finalCareerInfo context for each target', () => {
    const out = buildComparePrompt({
      mode: 'rich',
      targets: [
        { label: 'Data analyst', context: richCareer },
        { label: 'UX researcher', context: { ...richCareer, jobTitle: 'UX researcher', jobDescription: 'Studies users.' } },
      ],
    });
    expect(out).toContain('Existing career data');
    expect(out).toContain('$75-95k AUD');
    expect(out).toContain('Studies users.');
  });

  it('includes profile when provided', () => {
    const out = buildComparePrompt({
      ...baseQuick,
      resume: 'Third-year public health student at Curtin.',
    });
    expect(out).toContain('Curtin');
  });

  it('includes distilled profile when provided', () => {
    const out = buildComparePrompt({
      ...baseQuick,
      distilledProfile: {
        background: 'Nursing undergrad',
        interests: ['health data'],
        skills: ['statistics'],
        constraints: [],
        goals: ['policy work'],
      },
    });
    expect(out).toMatch(/nursing undergrad/i);
  });

  it('omits profile section when no profile fields provided', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).not.toContain('<profile>');
  });

  it('handles three targets', () => {
    const out = buildComparePrompt({
      mode: 'quick',
      targets: [
        { label: 'Data analyst' },
        { label: 'UX researcher' },
        { label: 'Product manager' },
      ],
    });
    expect(out).toContain('Product manager');
  });
});

describe('parseComparison', () => {
  const happyPath = JSON.stringify({
    roles: [
      {
        label: 'Data analyst',
        cells: {
          typicalDay: 'Morning standup, then SQL.',
          coreSkills: 'SQL, Python, Tableau.',
          trainingNeeded: '3-6 months focused study.',
          salaryRange: '$75-95k AUD entry.',
          workSetting: 'Small teams, mostly solo analysis.',
          whoItSuits: 'People who like patterns.',
          mainChallenge: 'Cleaning bad data is tedious.',
        },
      },
      {
        label: 'UX researcher',
        cells: {
          typicalDay: 'Interviews and synthesis.',
          coreSkills: 'Interviewing, writing, empathy.',
          trainingNeeded: 'Portfolio of 3-5 studies.',
          salaryRange: '$70-90k AUD entry.',
          workSetting: 'Cross-functional product teams.',
          whoItSuits: 'People who love understanding others.',
          mainChallenge: 'Stakeholders ignore findings.',
        },
      },
    ],
  });

  it('parses happy path', () => {
    const out = parseComparison(happyPath, baseQuick);
    expect(out.mode).toBe('quick');
    expect(out.roles).toHaveLength(2);
    expect(out.roles[0].label).toBe('Data analyst');
    expect(out.roles[0].cells.typicalDay).toBe('Morning standup, then SQL.');
    expect(out.roles[1].cells.mainChallenge).toBe('Stakeholders ignore findings.');
  });

  it('strips markdown code fences', () => {
    const out = parseComparison('```json\n' + happyPath + '\n```', baseQuick);
    expect(out.roles).toHaveLength(2);
  });

  it('attaches mode from input', () => {
    const out = parseComparison(happyPath, { ...baseQuick, mode: 'rich' });
    expect(out.mode).toBe('rich');
  });

  it('throws when role count does not match input target count', () => {
    const single = JSON.stringify({
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    expect(() => parseComparison(single, baseQuick)).toThrow(/2/);
  });

  it('throws when a role has empty label', () => {
    const broken = JSON.stringify({
      roles: [
        { label: '', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
        { label: 'B', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    expect(() => parseComparison(broken, baseQuick)).toThrow(/label/i);
  });

  it('coerces missing cells to em-dash', () => {
    const missing = JSON.stringify({
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x' } },
        { label: 'B', cells: {} },
      ],
    });
    const out = parseComparison(missing, baseQuick);
    expect(out.roles[0].cells.mainChallenge).toBe('—');
    expect(out.roles[1].cells.typicalDay).toBe('—');
    expect(out.roles[1].cells.mainChallenge).toBe('—');
  });
});
