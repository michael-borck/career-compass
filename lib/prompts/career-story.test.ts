import { describe, it, expect } from 'vitest';
import { buildCareerStoryPrompt, parseCareerStory } from './career-story';

describe('buildCareerStoryPrompt', () => {
  it('includes resume when provided', () => {
    expect(buildCareerStoryPrompt({ resume: 'Three years at Curtin.' })).toContain('Curtin');
  });

  it('includes about-me when provided', () => {
    expect(buildCareerStoryPrompt({ resume: 'r', freeText: 'I enjoy data work.' })).toContain('data work');
  });

  it('includes careers when provided', () => {
    const out = buildCareerStoryPrompt({
      resume: 'r',
      careers: [{ jobTitle: 'Data analyst', jobDescription: 'd', timeline: 't', salary: 's', difficulty: 'd', workRequired: 'w', aboutTheRole: 'a', whyItsagoodfit: [], roadmap: [] }],
    });
    expect(out).toContain('Data analyst');
  });

  it('includes gap analysis when provided', () => {
    const out = buildCareerStoryPrompt({
      resume: 'r',
      gapAnalysis: { target: 'Analyst', summary: 'Strong foundation', matches: ['SQL'], gaps: [], realisticTimeline: '3 months' },
    });
    expect(out).toContain('Strong foundation');
  });

  it('includes board review when provided', () => {
    const out = buildCareerStoryPrompt({
      resume: 'r',
      boardReview: {
        framing: 'f', focusRole: null,
        voices: [
          { role: 'recruiter', name: 'R', response: 'Keywords are strong.' },
          { role: 'hr', name: 'H', response: 'h' },
          { role: 'manager', name: 'M', response: 'm' },
          { role: 'mentor', name: 'Me', response: 'me' },
        ],
        synthesis: { agreements: ['Curiosity'], disagreements: [], topPriorities: [] },
      },
    });
    expect(out).toContain('Keywords are strong');
    expect(out).toContain('Curiosity');
  });

  it('includes odyssey lives when provided', () => {
    const makeLife = (type: 'current' | 'pivot' | 'wildcard', label: string) => ({
      type, label, seed: 's', headline: `${label} headline`, dayInTheLife: null,
      typicalWeek: [] as string[], toolsAndSkills: [] as string[], whoYouWorkWith: null, challenges: [] as string[],
      questionsToExplore: [] as string[], dashboard: { resources: null, likability: null, confidence: null, coherence: null },
    });
    const out = buildCareerStoryPrompt({
      resume: 'r',
      odysseyLives: {
        current: makeLife('current', 'Health data'),
        pivot: makeLife('pivot', 'Teaching'),
        wildcard: makeLife('wildcard', 'Furniture'),
      },
    });
    expect(out).toContain('Health data');
    expect(out).toContain('Teaching');
    expect(out).toContain('Furniture');
  });

  it('omits session sections that are null/undefined', () => {
    const out = buildCareerStoryPrompt({ resume: 'r' });
    expect(out).not.toContain('<careers>');
    expect(out).not.toContain('<gapAnalysis>');
    expect(out).not.toContain('<boardReview>');
    expect(out).not.toContain('<odysseyLives>');
  });

  it('asks for themes + narrative JSON shape', () => {
    const out = buildCareerStoryPrompt({ resume: 'r' });
    expect(out).toContain('"themes"');
    expect(out).toContain('"narrative"');
    expect(out).toContain('"name"');
    expect(out).toContain('"evidence"');
    expect(out).toContain('"reflectionQuestion"');
  });
});

describe('parseCareerStory', () => {
  const happy = JSON.stringify({
    themes: [
      { name: 'Data-driven decisions', evidence: ['Resume: SQL', 'Gap: analytics'], reflectionQuestion: 'Is data your core?' },
      { name: 'Helping others', evidence: ['About me: mentoring'], reflectionQuestion: 'What does service mean to you?' },
    ],
    narrative: 'I have always been drawn to making sense of data.\n\nWhat started as curiosity became a career direction.',
  });

  it('parses happy path', () => {
    const out = parseCareerStory(happy);
    expect(out.themes).toHaveLength(2);
    expect(out.themes[0].name).toBe('Data-driven decisions');
    expect(out.themes[0].evidence).toHaveLength(2);
    expect(out.narrative).toContain('making sense');
  });

  it('strips code fences', () => {
    expect(parseCareerStory('```json\n' + happy + '\n```').themes).toHaveLength(2);
  });

  it('throws on missing narrative', () => {
    expect(() => parseCareerStory(JSON.stringify({
      themes: [{ name: 'n', evidence: [], reflectionQuestion: 'q' }],
    }))).toThrow(/narrative/i);
  });

  it('throws on zero themes', () => {
    expect(() => parseCareerStory(JSON.stringify({ themes: [], narrative: 'n' }))).toThrow(/theme/i);
  });

  it('coerces missing evidence to empty array', () => {
    const out = parseCareerStory(JSON.stringify({
      themes: [{ name: 'n', reflectionQuestion: 'q' }],
      narrative: 'n',
    }));
    expect(out.themes[0].evidence).toEqual([]);
  });

  it('throws on theme with empty name', () => {
    expect(() => parseCareerStory(JSON.stringify({
      themes: [{ name: '', evidence: [], reflectionQuestion: 'q' }],
      narrative: 'n',
    }))).toThrow(/name/i);
  });
});
