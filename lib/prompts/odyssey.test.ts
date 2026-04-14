import { describe, it, expect } from 'vitest';
import { buildOdysseyElaboratePrompt, parseOdysseyElaboration } from './odyssey';

describe('buildOdysseyElaboratePrompt', () => {
  const base = {
    type: 'current' as const,
    label: 'Data analyst in a health nonprofit',
    seed: 'I finish my degree and join a small health research org.',
  };

  it('includes the label, seed, and type framing', () => {
    const out = buildOdysseyElaboratePrompt(base);
    expect(out).toContain('Data analyst in a health nonprofit');
    expect(out).toContain('I finish my degree');
    expect(out).toMatch(/current trajectory|natural extension/i);
  });

  it('uses different framing for pivot vs wildcard', () => {
    const pivot = buildOdysseyElaboratePrompt({ ...base, type: 'pivot' });
    const wildcard = buildOdysseyElaboratePrompt({ ...base, type: 'wildcard' });
    expect(pivot).toMatch(/pivot/i);
    expect(wildcard).toMatch(/wildcard|money, image/i);
    expect(pivot).not.toBe(wildcard);
  });

  it('asks for the full elaboration JSON shape', () => {
    const out = buildOdysseyElaboratePrompt(base);
    for (const key of ['headline', 'dayInTheLife', 'typicalWeek', 'toolsAndSkills', 'whoYouWorkWith', 'challenges', 'questionsToExplore']) {
      expect(out).toContain(`"${key}"`);
    }
  });

  it('includes profile context when provided', () => {
    const out = buildOdysseyElaboratePrompt({
      ...base,
      resume: 'Third-year public health student at Curtin.',
    });
    expect(out).toContain('Curtin');
  });

  it('includes distilled profile when provided', () => {
    const out = buildOdysseyElaboratePrompt({
      ...base,
      distilledProfile: {
        background: 'Public health undergrad',
        interests: ['community health'],
        skills: ['statistics'],
        constraints: [],
        goals: ['policy role'],
      },
    });
    expect(out).toContain('Public health undergrad');
  });
});

describe('parseOdysseyElaboration', () => {
  const full = JSON.stringify({
    headline: 'Turning data into health policy',
    dayInTheLife: 'Morning stand-up with the team, then cleaning survey data...',
    typicalWeek: ['2 days analysis', '1 day stakeholder meetings'],
    toolsAndSkills: ['Python', 'Tableau'],
    whoYouWorkWith: 'Small team of researchers and program staff.',
    challenges: ['Lower salary', 'Funding instability'],
    questionsToExplore: ['Which orgs hire for this?', 'What qualifications do I need?'],
  });

  it('parses a full elaboration', () => {
    const out = parseOdysseyElaboration(full);
    expect(out.headline).toBe('Turning data into health policy');
    expect(out.typicalWeek).toHaveLength(2);
    expect(out.challenges).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const out = parseOdysseyElaboration('```json\n' + full + '\n```');
    expect(out.headline).toBe('Turning data into health policy');
  });

  it('throws when headline is missing', () => {
    const broken = JSON.stringify({ dayInTheLife: 'x', whoYouWorkWith: 'y' });
    expect(() => parseOdysseyElaboration(broken)).toThrow(/headline/);
  });

  it('throws when dayInTheLife is missing', () => {
    const broken = JSON.stringify({ headline: 'x', whoYouWorkWith: 'y' });
    expect(() => parseOdysseyElaboration(broken)).toThrow(/dayInTheLife/);
  });

  it('throws when whoYouWorkWith is missing', () => {
    const broken = JSON.stringify({ headline: 'x', dayInTheLife: 'y' });
    expect(() => parseOdysseyElaboration(broken)).toThrow(/whoYouWorkWith/);
  });

  it('coerces missing optional arrays to empty arrays', () => {
    const minimal = JSON.stringify({
      headline: 'h',
      dayInTheLife: 'd',
      whoYouWorkWith: 'w',
    });
    const out = parseOdysseyElaboration(minimal);
    expect(out.typicalWeek).toEqual([]);
    expect(out.toolsAndSkills).toEqual([]);
    expect(out.challenges).toEqual([]);
    expect(out.questionsToExplore).toEqual([]);
  });
});
