import { describe, it, expect } from 'vitest';
import { gapAnalysisToMarkdown, learningPathToMarkdown } from './markdown-export';
import type { GapAnalysis, LearningPath } from './session-store';

const gap: GapAnalysis = {
  target: 'Data Analyst',
  summary: 'You are well placed but need SQL depth.',
  matches: ['SQL basics', 'Stats background'],
  gaps: [
    {
      title: 'Intermediate SQL',
      category: 'technical',
      severity: 'critical',
      why: 'Required for the role',
      targetLevel: 'Joins, window functions, CTEs',
      currentLevel: 'Basic SELECT',
      evidenceIdeas: ['Portfolio project with real data', 'Intermediate SQL course'],
    },
  ],
  realisticTimeline: '3-6 months',
};

const path: LearningPath = {
  target: 'Data Analyst',
  summary: 'A 12-week path to data analyst readiness.',
  prerequisites: ['Basic computer literacy', '10 hrs/week'],
  milestones: [
    {
      weekRange: 'Weeks 1-2',
      focus: 'Python basics',
      activities: ['Complete a beginner Python course', 'Build a small script'],
      outcome: 'Comfortable with Python syntax',
    },
  ],
  portfolioProject: 'Build an end-to-end dashboard from a public dataset.',
  totalDuration: '12 weeks',
  caveats: ['AI-generated', 'Timeline assumes 10 hrs/week'],
};

describe('gapAnalysisToMarkdown', () => {
  it('renders a header with the target', () => {
    const md = gapAnalysisToMarkdown(gap);
    expect(md).toContain('# Gap Analysis: Data Analyst');
  });

  it('renders matches as a bullet list', () => {
    const md = gapAnalysisToMarkdown(gap);
    expect(md).toContain('## What you already have');
    expect(md).toContain('- SQL basics');
    expect(md).toContain('- Stats background');
  });

  it('renders each gap with severity, why, levels, and evidence', () => {
    const md = gapAnalysisToMarkdown(gap);
    expect(md).toContain('### [CRITICAL] Intermediate SQL');
    expect(md).toContain('**Why it matters:** Required for the role');
    expect(md).toContain('**Target level:** Joins, window functions, CTEs');
    expect(md).toContain('**Current level:** Basic SELECT');
    expect(md).toContain('- Portfolio project with real data');
  });

  it('omits Current level when null', () => {
    const g = { ...gap, gaps: [{ ...gap.gaps[0], currentLevel: null }] };
    const md = gapAnalysisToMarkdown(g);
    expect(md).not.toContain('Current level');
  });

  it('renders the timeline and AI footnote', () => {
    const md = gapAnalysisToMarkdown(gap);
    expect(md).toContain('## Rough timeline');
    expect(md).toContain('3-6 months');
    expect(md).toContain('AI-generated');
  });
});

describe('learningPathToMarkdown', () => {
  it('renders a header with the target and total duration', () => {
    const md = learningPathToMarkdown(path);
    expect(md).toContain('# Learning Path: Data Analyst');
    expect(md).toContain('**Total duration:** 12 weeks');
  });

  it('renders prerequisites as a bullet list', () => {
    const md = learningPathToMarkdown(path);
    expect(md).toContain('## Before you start');
    expect(md).toContain('- Basic computer literacy');
  });

  it('renders each milestone with activities and outcome', () => {
    const md = learningPathToMarkdown(path);
    expect(md).toContain('### Weeks 1-2 · Python basics');
    expect(md).toContain('**Activities:**');
    expect(md).toContain('- Complete a beginner Python course');
    expect(md).toContain('**Outcome:** Comfortable with Python syntax');
  });

  it('renders the portfolio project and caveats', () => {
    const md = learningPathToMarkdown(path);
    expect(md).toContain('## Portfolio project');
    expect(md).toContain('end-to-end dashboard');
    expect(md).toContain('## Caveats');
    expect(md).toContain('- AI-generated');
  });
});
