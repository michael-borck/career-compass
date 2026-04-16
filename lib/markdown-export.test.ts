import { describe, it, expect } from 'vitest';
import {
  gapAnalysisToMarkdown,
  learningPathToMarkdown,
  interviewFeedbackToMarkdown,
  boardReviewToMarkdown,
} from './markdown-export';
import type { GapAnalysis, LearningPath, InterviewFeedback, SourceRef, BoardReview } from './session-store';

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

function makeReview(overrides: Partial<BoardReview> = {}): BoardReview {
  return {
    framing: 'I feel too academic for industry.',
    focusRole: 'Data analyst',
    voices: [
      { role: 'recruiter', name: 'The Recruiter', response: 'Your resume needs keywords.' },
      { role: 'hr', name: 'The HR Partner', response: 'Culture fit seems strong.' },
      { role: 'manager', name: 'The Hiring Manager', response: 'I would probe your projects.' },
      { role: 'mentor', name: 'The Mentor', response: 'You have real curiosity.' },
    ],
    synthesis: {
      agreements: ['Curiosity is a strong signal'],
      disagreements: ['The Recruiter wants keywords; the Mentor sees depth'],
      topPriorities: ['Rewrite projects in industry language', 'Add measurable outcomes'],
    },
    ...overrides,
  };
}

describe('boardReviewToMarkdown', () => {
  it('renders happy path with framing, focus, voices, and synthesis', () => {
    const md = boardReviewToMarkdown(makeReview());
    expect(md).toContain('# Board of Advisors Review');
    expect(md).toContain('**Your framing:** I feel too academic for industry.');
    expect(md).toContain('**Focus role:** Data analyst');
    expect(md).toContain('## The Recruiter');
    expect(md).toContain('## The HR Partner');
    expect(md).toContain('## The Hiring Manager');
    expect(md).toContain('## The Mentor');
    expect(md).toContain('Your resume needs keywords.');
    expect(md).toContain('## Where the board landed');
    expect(md).toContain('### Where they agreed');
    expect(md).toContain('### Where they pushed back on each other');
    expect(md).toContain('### What to work on');
    expect(md).toContain('1. Rewrite projects in industry language');
    expect(md).toContain('2. Add measurable outcomes');
  });

  it('renders empty framing as open review placeholder', () => {
    const md = boardReviewToMarkdown(makeReview({ framing: '' }));
    expect(md).toContain('**Your framing:** Open review — no specific focus');
  });

  it('renders null focus role as None', () => {
    const md = boardReviewToMarkdown(makeReview({ focusRole: null }));
    expect(md).toContain('**Focus role:** None');
  });

  it('skips empty synthesis subsections', () => {
    const md = boardReviewToMarkdown(
      makeReview({
        synthesis: {
          agreements: ['Only this one'],
          disagreements: [],
          topPriorities: [],
        },
      })
    );
    expect(md).toContain('### Where they agreed');
    expect(md).not.toContain('### Where they pushed back on each other');
    expect(md).not.toContain('### What to work on');
  });

  it('ends with the AI-generated footer', () => {
    const md = boardReviewToMarkdown(makeReview());
    expect(md.trim().endsWith('*Four AI-generated perspectives. Disagreement is part of the exercise.*')).toBe(true);
  });
});

import { comparisonToMarkdown, pitchToMarkdown, coverLetterToMarkdown, resumeReviewToMarkdown } from './markdown-export';
import type { Comparison, ElevatorPitch, CoverLetter, ResumeReview } from './session-store';

function makeComparison(mode: 'quick' | 'rich', roleCount: 2 | 3): Comparison {
  const roleLabels = ['Data analyst', 'UX researcher', 'Product manager'].slice(0, roleCount);
  return {
    mode,
    roles: roleLabels.map((label) => ({
      label,
      cells: {
        typicalDay: `${label} typical day`,
        coreSkills: `${label} core skills`,
        trainingNeeded: `${label} training`,
        salaryRange: `${label} salary`,
        workSetting: `${label} setting`,
        whoItSuits: `${label} suits`,
        mainChallenge: `${label} main challenge`,
      },
    })),
  };
}

describe('comparisonToMarkdown', () => {
  it('renders quick mode header for 2 roles', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 2));
    expect(md).toContain('# Career Comparison');
    expect(md).toContain('Quick compare');
    expect(md).toContain('vague, makes assumptions');
    expect(md).toContain('1. Data analyst');
    expect(md).toContain('2. UX researcher');
    expect(md).not.toContain('3. Product manager');
  });

  it('renders rich mode header for 3 roles', () => {
    const md = comparisonToMarkdown(makeComparison('rich', 3));
    expect(md).toContain('Rich compare');
    expect(md).toContain('spider graph');
    expect(md).toContain('1. Data analyst');
    expect(md).toContain('3. Product manager');
  });

  it('renders all seven dimension sections', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 2));
    expect(md).toContain('### Typical day');
    expect(md).toContain('### Core skills');
    expect(md).toContain('### Training needed');
    expect(md).toContain('### Salary range');
    expect(md).toContain('### Work setting');
    expect(md).toContain('### Who it suits');
    expect(md).toContain('### Main challenge');
  });

  it('renders each role as a bullet under each dimension section', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 3));
    expect(md).toContain('- **Data analyst:** Data analyst typical day');
    expect(md).toContain('- **UX researcher:** UX researcher core skills');
    expect(md).toContain('- **Product manager:** Product manager main challenge');
  });

  it('ends with AI-generated footer', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 2));
    expect(md.trim().endsWith(
      '*AI-generated comparison. Treat specific salary figures and training timelines as starting points, not guarantees.*'
    )).toBe(true);
  });
});

describe('pitchToMarkdown', () => {
  const pitch: ElevatorPitch = {
    target: 'Data analyst', hook: 'Did you know data drives every decision?',
    body: 'I bring analytical experience.', close: 'I am looking for an entry-level role.',
    fullScript: 'Did you know data drives every decision? I bring analytical experience. I am looking for an entry-level role.',
  };
  it('renders all sections', () => {
    const md = pitchToMarkdown(pitch);
    expect(md).toContain('# Elevator Pitch');
    expect(md).toContain('**Target:** Data analyst');
    expect(md).toContain('## Your hook');
    expect(md).toContain('## The pitch');
    expect(md).toContain('## Your close');
    expect(md).toContain('## Full script');
  });
  it('renders null target as General', () => {
    expect(pitchToMarkdown({ ...pitch, target: null })).toContain('**Target:** General');
  });
  it('ends with footer', () => {
    expect(pitchToMarkdown(pitch).trim()).toMatch(/Edit to match your voice/);
  });
});

describe('coverLetterToMarkdown', () => {
  const letter: CoverLetter = {
    target: 'Data analyst at Acme', greeting: 'Dear Hiring Manager,',
    body: 'I am writing to express my interest.\n\nWith my background in statistics...',
    closing: 'Sincerely,\nStudent Name',
  };
  it('renders the letter', () => {
    const md = coverLetterToMarkdown(letter);
    expect(md).toContain('# Cover Letter');
    expect(md).toContain('**Target:** Data analyst at Acme');
    expect(md).toContain('Dear Hiring Manager,');
    expect(md).toContain('Sincerely,');
  });
  it('ends with footer', () => {
    expect(coverLetterToMarkdown(letter).trim()).toMatch(/Edit before sending/);
  });
});

describe('resumeReviewToMarkdown', () => {
  const review: ResumeReview = {
    target: 'Data analyst', overallImpression: 'Solid foundation.',
    strengths: ['Clear structure'],
    improvements: [{ section: 'Summary', suggestion: 'Add target', why: 'Focus', example: 'Aspiring data analyst...' }],
    keywordsToAdd: ['SQL'], structuralNotes: ['Move projects above education'],
  };
  it('renders all sections', () => {
    const md = resumeReviewToMarkdown(review);
    expect(md).toContain('# Resume Review');
    expect(md).toContain('## Overall impression');
    expect(md).toContain("## What's working");
    expect(md).toContain('## Suggested improvements');
    expect(md).toContain('### 1. Summary');
    expect(md).toContain('## Keywords to add');
    expect(md).toContain('## Structural notes');
  });
  it('renders null target as General review', () => {
    expect(resumeReviewToMarkdown({ ...review, target: null })).toContain('**Target:** General review');
  });
  it('skips empty sections', () => {
    const md = resumeReviewToMarkdown({ ...review, keywordsToAdd: [], structuralNotes: [] });
    expect(md).not.toContain('## Keywords to add');
    expect(md).not.toContain('## Structural notes');
  });
  it('ends with footer', () => {
    expect(resumeReviewToMarkdown(review).trim()).toMatch(/starting point/);
  });
});

import { careerStoryToMarkdown } from './markdown-export';
import type { CareerStory } from './session-store';

describe('careerStoryToMarkdown', () => {
  const story: CareerStory = {
    themes: [
      { name: 'Data-driven decisions', evidence: ['Resume: SQL', 'Gap: analytics'], reflectionQuestion: 'Is data your core?' },
      { name: 'Helping others', evidence: ['About me: mentoring'], reflectionQuestion: 'What does service mean to you?' },
    ],
    narrative: 'I have always been drawn to making sense of data.\n\nWhat started as curiosity became a career direction.',
  };

  it('renders narrative and themes', () => {
    const md = careerStoryToMarkdown(story);
    expect(md).toContain('# My Career Story');
    expect(md).toContain('## The narrative');
    expect(md).toContain('making sense of data');
    expect(md).toContain('## Themes');
    expect(md).toContain('### 1. Data-driven decisions');
    expect(md).toContain('- Resume: SQL');
    expect(md).toContain('*Is data your core?*');
    expect(md).toContain('### 2. Helping others');
  });

  it('ends with footer', () => {
    expect(careerStoryToMarkdown(story).trim()).toMatch(/starting point/);
  });
});
