import { describe, it, expect } from 'vitest';
import {
  gapAnalysisToMarkdown,
  learningPathToMarkdown,
  interviewFeedbackToMarkdown,
} from './markdown-export';
import type { GapAnalysis, LearningPath, InterviewFeedback, SourceRef } from './session-store';

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

const feedback: InterviewFeedback = {
  target: 'Data Analyst',
  difficulty: 'standard',
  summary: 'Solid effort with clear room to grow.',
  strengths: ['Clear intro', 'Good Python example', 'Asked thoughtful questions back'],
  improvements: [
    {
      area: 'Use STAR structure for behavioural answers',
      why: 'Behavioural questions reward concrete situation/action/result framing.',
      example: 'Instead of "I worked on a team project" you could say "When NPS dropped 15 points (S), I led customer interviews (TA), and we improved NPS by 22 points (R)."',
    },
    {
      area: 'Quantify your impact with numbers',
      why: 'Numbers make impact memorable.',
      example: 'Add numbers like "increased throughput by 40%" wherever you can.',
    },
  ],
  perPhase: [
    { phase: 'warm-up', note: 'Confident and concise' },
    { phase: 'behavioural', note: 'Stories were engaging but missing the Result' },
  ],
  overallRating: 'on-track',
  nextSteps: [
    'Practice 3 STAR answers from your work history',
    'Brush up on SQL window functions',
    'Prepare 5 thoughtful questions to ask interviewers',
  ],
};

describe('interviewFeedbackToMarkdown', () => {
  it('renders the header with target and difficulty', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('# Interview Feedback: Data Analyst');
    expect(md).toContain('**Difficulty:** Standard');
    expect(md).toContain('**Overall rating:** On track');
  });

  it('renders strengths as a bullet list', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('## What you did well');
    expect(md).toContain('- Clear intro');
    expect(md).toContain('- Good Python example');
  });

  it('renders each improvement with area, why, and example', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('### 1. Use STAR structure for behavioural answers');
    expect(md).toContain('**Why it matters:**');
    expect(md).toContain('**Example reframe of your answer:**');
    expect(md).toContain('NPS dropped 15 points');
  });

  it('numbers improvements starting at 1', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('### 1.');
    expect(md).toContain('### 2.');
  });

  it('renders per-phase notes when present', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('## By phase');
    expect(md).toContain('**Warm-up:**');
    expect(md).toContain('Confident and concise');
  });

  it('renders next steps as a numbered list', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('## Next steps');
    expect(md).toContain('1. Practice 3 STAR answers');
    expect(md).toContain('3. Prepare 5 thoughtful questions');
  });

  it('includes the AI-generated footnote', () => {
    const md = interviewFeedbackToMarkdown(feedback);
    expect(md).toContain('AI-generated');
  });
});

import { odysseyPlanToMarkdown } from './markdown-export';
import type { OdysseyLife, OdysseyLifeType } from './session-store';

function makeLife(type: OdysseyLifeType, overrides: Partial<OdysseyLife> = {}): OdysseyLife {
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
    ...overrides,
  };
}

function fullyElaborated(type: OdysseyLifeType, label: string): OdysseyLife {
  return makeLife(type, {
    label,
    seed: 'seed text',
    headline: `${label} headline`,
    dayInTheLife: `A day for ${label}`,
    typicalWeek: ['Mon: a', 'Tue: b'],
    toolsAndSkills: ['tool1', 'tool2'],
    whoYouWorkWith: `People of ${label}`,
    challenges: ['ch1', 'ch2'],
    questionsToExplore: ['q1', 'q2'],
    dashboard: { resources: 3, likability: 4, confidence: 2, coherence: 5 },
  });
}

describe('odysseyPlanToMarkdown', () => {
  it('renders three elaborated lives with headers, day, week, tools, who, challenges, questions, dashboard', () => {
    const md = odysseyPlanToMarkdown({
      current: fullyElaborated('current', 'Current Path'),
      pivot: fullyElaborated('pivot', 'The Pivot'),
      wildcard: fullyElaborated('wildcard', 'The Wildcard'),
    });
    expect(md).toContain('# Odyssey Plan');
    expect(md).toContain('## Life 1 — Current Path');
    expect(md).toContain('## Life 2 — The Pivot');
    expect(md).toContain('## Life 3 — The Wildcard');
    expect(md).toContain('### A day in 2030');
    expect(md).toContain('### Typical week');
    expect(md).toContain('### Tools & skills');
    expect(md).toContain('### Who you work with');
    expect(md).toContain('### Challenges');
    expect(md).toContain('### Questions to explore');
    expect(md).toContain('### How does this feel?');
    expect(md).toContain('**Resources:** 3/5');
    expect(md).toContain('**Likability:** 4/5');
    expect(md).toContain('**Confidence:** 2/5');
    expect(md).toContain('**Coherence:** 5/5');
  });

  it('shows placeholder note for unelaborated lives with a seed', () => {
    const md = odysseyPlanToMarkdown({
      current: fullyElaborated('current', 'Current Path'),
      pivot: makeLife('pivot', { label: 'Pivot idea', seed: 'something' }),
      wildcard: makeLife('wildcard'),
    });
    expect(md).toContain('This life has not been elaborated yet.');
    expect(md).toContain('Pivot idea');
  });

  it('renders null dashboard values as "— not yet rated"', () => {
    const md = odysseyPlanToMarkdown({
      current: { ...fullyElaborated('current', 'Current'), dashboard: { resources: null, likability: null, confidence: null, coherence: null } },
      pivot: fullyElaborated('pivot', 'Pivot'),
      wildcard: fullyElaborated('wildcard', 'Wildcard'),
    });
    expect(md).toContain('**Resources:** — not yet rated');
    expect(md).toContain('**Coherence:** — not yet rated');
  });

  it('renders mixed dashboard with only rated dimensions as N/5', () => {
    const life = fullyElaborated('current', 'Mixed');
    life.dashboard = { resources: 3, likability: null, confidence: 4, coherence: null };
    const md = odysseyPlanToMarkdown({
      current: life,
      pivot: makeLife('pivot'),
      wildcard: makeLife('wildcard'),
    });
    expect(md).toContain('**Resources:** 3/5');
    expect(md).toContain('**Likability:** — not yet rated');
    expect(md).toContain('**Confidence:** 4/5');
  });

  it('ends with the AI-generated footer', () => {
    const md = odysseyPlanToMarkdown({
      current: makeLife('current'),
      pivot: makeLife('pivot'),
      wildcard: makeLife('wildcard'),
    });
    expect(md.trim().endsWith('*AI-generated elaboration. Dashboard ratings are your own reflection.*')).toBe(true);
  });
});

const sources: SourceRef[] = [
  { title: 'Glassdoor — Data Analyst', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
  { title: 'Seek — Data Analyst Perth', url: 'https://seek.com.au/y', domain: 'seek.com.au' },
];

describe('source rendering in markdown', () => {
  it('gap analysis markdown includes sources section when provided', () => {
    const md = gapAnalysisToMarkdown(gap, sources);
    expect(md).toContain('## Sources');
    expect(md).toContain('[Glassdoor — Data Analyst](https://glassdoor.com/x)');
    expect(md).toContain('[Seek — Data Analyst Perth](https://seek.com.au/y)');
  });

  it('gap analysis markdown omits sources section when no sources', () => {
    const md = gapAnalysisToMarkdown(gap);
    expect(md).not.toContain('## Sources');
  });

  it('learning path markdown includes sources section when provided', () => {
    const md = learningPathToMarkdown(path, sources);
    expect(md).toContain('## Sources');
  });

  it('interview feedback markdown includes sources section when provided', () => {
    const md = interviewFeedbackToMarkdown(feedback, sources);
    expect(md).toContain('## Sources consulted');
  });
});
