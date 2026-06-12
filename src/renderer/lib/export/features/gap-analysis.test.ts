import { describe, it, expect } from 'vitest';
import { gapAnalysisToExportDoc } from './gap-analysis';
import { toMarkdown } from '../to-markdown';
import type { GapAnalysis } from '@/lib/session-store';

const analysis: GapAnalysis = {
  target: 'Data analyst',
  summary: 'Close but for SQL.',
  matches: ['Python', 'Statistics'],
  gaps: [
    {
      title: 'SQL',
      category: 'technical',
      severity: 'critical',
      why: 'Every posting asks for it',
      targetLevel: 'Joins and window functions',
      currentLevel: 'Basics',
      evidenceIdeas: ['Build a SQL portfolio query'],
    },
    {
      title: 'Dashboarding',
      category: 'technical',
      severity: 'nice-to-have',
      why: '',
      targetLevel: '',
      currentLevel: null,
      evidenceIdeas: [],
    },
  ],
  realisticTimeline: 'Three months part-time.',
};

describe('gapAnalysisToExportDoc', () => {
  it('renders summary, matches, severity-tagged gaps, and timeline', () => {
    const md = toMarkdown(gapAnalysisToExportDoc(analysis));
    expect(md).toContain('# Gap Analysis: Data analyst');
    expect(md).toContain('Close but for SQL.');
    expect(md).toContain('- Python');
    expect(md).toContain('### [CRITICAL] SQL');
    expect(md).toContain('**Why it matters:** Every posting asks for it');
    expect(md).toContain('**Current level:** Basics');
    expect(md).toContain('- Build a SQL portfolio query');
    expect(md).toContain('### [NICE-TO-HAVE] Dashboarding');
    expect(md).toContain('Three months part-time.');
    expect(md).not.toContain('Sources');
  });

  it('omits the matches section when empty and renders sources when provided', () => {
    const md = toMarkdown(
      gapAnalysisToExportDoc({ ...analysis, matches: [] }, [
        { title: 'Role guide', url: 'https://example.com/g', domain: 'example.com' },
      ])
    );
    expect(md).not.toContain('What you already have');
    expect(md).toContain('## Sources');
    expect(md).toContain('[Role guide](https://example.com/g) — example.com');
  });

  it('skips empty optional fields inside a gap', () => {
    const md = toMarkdown(gapAnalysisToExportDoc({ ...analysis, gaps: [analysis.gaps[1]] }));
    expect(md).not.toContain('Why it matters:');
    expect(md).not.toContain('Current level:');
    expect(md).not.toContain('How to demonstrate:');
  });
});
