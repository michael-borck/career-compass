import { describe, it, expect } from 'vitest';
import { learningPathToExportDoc } from './learning-path';
import { toMarkdown } from '../to-markdown';
import type { LearningPath } from '@/lib/session-store';

const path: LearningPath = {
  target: 'Data analyst',
  summary: 'Twelve weeks to job-ready.',
  prerequisites: ['Spreadsheet basics'],
  milestones: [
    {
      weekRange: 'Weeks 1–4',
      focus: 'SQL foundations',
      activities: ['Daily query practice'],
      outcome: 'Comfortable with joins',
    },
    { weekRange: 'Weeks 5–8', focus: 'Dashboards', activities: [], outcome: '' },
  ],
  portfolioProject: 'Analyse a public dataset end to end.',
  totalDuration: '12 weeks',
  caveats: ['Assumes 10 hours a week'],
};

describe('learningPathToExportDoc', () => {
  it('renders summary, duration, prerequisites, milestones, project, and caveats', () => {
    const md = toMarkdown(learningPathToExportDoc(path));
    expect(md).toContain('# Learning Path: Data analyst');
    expect(md).toContain('Twelve weeks to job-ready.');
    expect(md).toContain('**Total duration:** 12 weeks');
    expect(md).toContain('- Spreadsheet basics');
    expect(md).toContain('### Weeks 1–4 · SQL foundations');
    expect(md).toContain('- Daily query practice');
    expect(md).toContain('**Outcome:** Comfortable with joins');
    expect(md).toContain('## Portfolio project');
    expect(md).toContain('- Assumes 10 hours a week');
  });

  it('omits empty optional sections and renders sources when provided', () => {
    const md = toMarkdown(
      learningPathToExportDoc(
        { ...path, prerequisites: [], portfolioProject: '', caveats: [] },
        [{ title: 'Curriculum', url: 'https://example.com/c', domain: 'example.com' }]
      )
    );
    expect(md).not.toContain('Before you start');
    expect(md).not.toContain('Portfolio project');
    expect(md).not.toContain('Caveats');
    expect(md).toContain('[Curriculum](https://example.com/c) — example.com');
  });
});
