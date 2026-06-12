import { describe, it, expect } from 'vitest';
import { industryExplorationToExportDoc } from './industry';
import { toMarkdown } from '../to-markdown';
import type { IndustryExploration } from '@/lib/session-store';

const exploration: IndustryExploration = {
  industry: 'Mining technology',
  overview: 'Big sector.\n\nLots of data roles.',
  keyRoles: [
    { title: 'Mine planner', description: 'Plans pits.', entryLevel: false },
    { title: 'Data technician', description: 'Wrangles sensors.', entryLevel: true },
  ],
  entryPoints: ['Vacation programs'],
  growthAreas: ['Autonomous haulage'],
  dayInTheLife: 'Early starts, lots of dashboards.',
  challenges: ['FIFO rosters'],
  skillsInDemand: ['Python'],
};

describe('industryExplorationToExportDoc', () => {
  it('renders overview, roles with entry-level tags, and every list section', () => {
    const md = toMarkdown(industryExplorationToExportDoc(exploration));
    expect(md).toContain('# Industry Exploration: Mining technology');
    expect(md).toContain('Big sector.');
    expect(md).toContain('### Mine planner');
    expect(md).toContain('### Data technician [Entry-level friendly]');
    expect(md).toContain('## How to break in');
    expect(md).toContain("## What's growing");
    expect(md).toContain('## A day in the life');
    expect(md).toContain('## Skills in demand');
    expect(md).toContain('## Challenges to know about');
  });

  it('omits optional sections when their data is empty', () => {
    const md = toMarkdown(
      industryExplorationToExportDoc({
        ...exploration,
        entryPoints: [],
        growthAreas: [],
        dayInTheLife: '',
        challenges: [],
        skillsInDemand: [],
      })
    );
    expect(md).not.toContain('How to break in');
    expect(md).not.toContain("What's growing");
    expect(md).not.toContain('A day in the life');
    expect(md).not.toContain('Skills in demand');
    expect(md).not.toContain('Challenges to know about');
  });
});
