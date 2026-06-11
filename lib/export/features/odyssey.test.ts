import { describe, it, expect } from 'vitest';
import { odysseyPlanToExportDoc } from './odyssey';
import { toMarkdown } from '../to-markdown';
import type { OdysseyLife, OdysseyLifeType } from '@/lib/session-store';

function emptyLife(type: OdysseyLifeType): OdysseyLife {
  return {
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
  };
}

function lives(overrides: Partial<Record<OdysseyLifeType, Partial<OdysseyLife>>> = {}) {
  return {
    current: { ...emptyLife('current'), ...overrides.current },
    pivot: { ...emptyLife('pivot'), ...overrides.pivot },
    wildcard: { ...emptyLife('wildcard'), ...overrides.wildcard },
  };
}

describe('odysseyPlanToExportDoc', () => {
  it('renders all three lives in order with fallback labels', () => {
    const md = toMarkdown(odysseyPlanToExportDoc(lives()));
    expect(md).toContain('# Odyssey Plan: Three Alternative Lives');
    const current = md.indexOf('## Life 1 — Current Path');
    const pivot = md.indexOf('## Life 2 — The Pivot');
    const wildcard = md.indexOf('## Life 3 — The Wildcard');
    expect(current).toBeGreaterThan(-1);
    expect(pivot).toBeGreaterThan(current);
    expect(wildcard).toBeGreaterThan(pivot);
  });

  it('marks un-elaborated lives and shows their seed', () => {
    const md = toMarkdown(odysseyPlanToExportDoc(lives({ current: { seed: 'Stay the course' } })));
    expect(md).toContain('**Seed:** Stay the course');
    expect(md).toContain('*(This life has not been elaborated yet.)*');
  });

  it('renders an elaborated life with sections and rated dashboard', () => {
    const md = toMarkdown(
      odysseyPlanToExportDoc(
        lives({
          pivot: {
            label: 'UX research',
            headline: 'You moved into UX.',
            dayInTheLife: 'Interviews in the morning.',
            typicalWeek: ['Mon: synthesis'],
            toolsAndSkills: ['Figma'],
            whoYouWorkWith: 'Designers and PMs',
            challenges: ['Stakeholder buy-in'],
            questionsToExplore: ['Do I like ambiguity?'],
            dashboard: { resources: 3, likability: 5, confidence: 2, coherence: 4 },
          },
        })
      )
    );
    expect(md).toContain('## Life 2 — The Pivot: UX research');
    expect(md).toContain('**You moved into UX.**');
    expect(md).toContain('### A day in 2030');
    expect(md).toContain('- Mon: synthesis');
    expect(md).toContain('### Who you work with');
    expect(md).toContain('**Likability:** 5/5');
    expect(md).toContain('**Resources:** 3/5');
  });

  it('shows unrated dashboard rows as not yet rated', () => {
    const md = toMarkdown(odysseyPlanToExportDoc(lives()));
    expect(md).toContain('**Resources:** — not yet rated');
  });
});
