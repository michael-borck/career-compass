import { describe, it, expect } from 'vitest';
import { careerPackToExportDoc, countPackSections } from './career-pack';
import { toMarkdown } from '../to-markdown';
import type {
  GapAnalysis,
  ElevatorPitch,
  CareerStory,
  OdysseyLife,
  OdysseyLifeType,
} from '@/lib/session-store';

const gapAnalysis: GapAnalysis = {
  target: 'Data analyst',
  summary: 'Close but for SQL.',
  matches: [],
  gaps: [],
  realisticTimeline: 'Three months.',
};

const pitch: ElevatorPitch = {
  target: 'Data analyst',
  hook: 'h',
  body: 'b',
  close: 'c',
  fullScript: 'The full pitch.',
};

const story: CareerStory = {
  narrative: 'It started in a lab.',
  themes: [{ name: 'Curiosity', evidence: [], reflectionQuestion: '' }],
};

describe('careerPackToExportDoc', () => {
  it('returns null for an empty session', () => {
    expect(careerPackToExportDoc({})).toBeNull();
    expect(countPackSections({})).toBe(0);
  });

  it('bundles only the completed activities, story first', () => {
    const doc = careerPackToExportDoc({ gapAnalysis, elevatorPitch: pitch, careerStory: story })!;
    const md = toMarkdown(doc);
    expect(md).toContain('# Career Pack');
    expect(md).toContain('3 sections');
    const storyIdx = md.indexOf('## ■ My Career Story');
    const gapIdx = md.indexOf('## ■ Gap Analysis: Data analyst');
    const pitchIdx = md.indexOf('## ■ Elevator Pitch');
    expect(storyIdx).toBeGreaterThan(-1);
    expect(gapIdx).toBeGreaterThan(storyIdx);
    expect(pitchIdx).toBeGreaterThan(gapIdx);
    expect(md).toContain('It started in a lab.');
    expect(md).toContain('The full pitch.');
    // Nothing else leaked in.
    expect(md).not.toContain('Learning Path');
    expect(md).not.toContain('Resume Review');
  });

  it('carries a single disclaimer instead of one per section', () => {
    const doc = careerPackToExportDoc({ gapAnalysis, elevatorPitch: pitch })!;
    const disclaimers = doc.blocks.filter((b) => b.kind === 'disclaimer');
    expect(disclaimers).toHaveLength(1);
  });

  it('includes the odyssey only when at least one life is elaborated', () => {
    const emptyLife = (type: OdysseyLifeType): OdysseyLife => ({
      type,
      label: '',
      seed: '',
      headline: null,
      dayInTheLife: null,
      typicalWeek: [],
      toolsAndSkills: [],
      whoYouWorkWith: null,
      challenges: [],
      questionsToExplore: [],
      dashboard: { resources: null, likability: null, confidence: null, coherence: null },
    });
    const lives = {
      current: emptyLife('current'),
      pivot: emptyLife('pivot'),
      wildcard: emptyLife('wildcard'),
    };
    expect(countPackSections({ odysseyLives: lives })).toBe(0);
    lives.pivot.headline = 'You moved into UX.';
    expect(countPackSections({ odysseyLives: lives })).toBe(1);
  });
});
