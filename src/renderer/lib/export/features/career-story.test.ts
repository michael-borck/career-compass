import { describe, it, expect } from 'vitest';
import { careerStoryToExportDoc } from './career-story';
import { toMarkdown } from '../to-markdown';
import type { CareerStory } from '@/lib/session-store';

const story: CareerStory = {
  narrative: 'It started in a lab.\n\nThen it moved to data.',
  themes: [
    {
      name: 'Curiosity',
      evidence: ['Taught yourself Python', 'Side projects'],
      reflectionQuestion: 'Where does curiosity pull you next?',
    },
    { name: 'Service', evidence: [], reflectionQuestion: '' },
  ],
};

describe('careerStoryToExportDoc', () => {
  it('renders narrative paragraphs and numbered themes with evidence', () => {
    const md = toMarkdown(careerStoryToExportDoc(story));
    expect(md).toContain('# My Career Story');
    expect(md).toContain('It started in a lab.');
    expect(md).toContain('Then it moved to data.');
    expect(md).toContain('### 1. Curiosity');
    expect(md).toContain('- Taught yourself Python');
    expect(md).toContain('*Where does curiosity pull you next?*');
    expect(md).toContain('### 2. Service');
  });

  it('skips evidence and reflection blocks when a theme has none', () => {
    const md = toMarkdown(careerStoryToExportDoc({ ...story, themes: [story.themes[1]] }));
    expect(md).not.toContain('Evidence:');
  });
});
