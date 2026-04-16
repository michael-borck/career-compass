# F15 Career Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Career Story capstone feature — the LLM reads the student's full session data, identifies 3-5 recurring themes, and writes a first-person narrative weaving them together. Result view shows narrative first, themes below. Exports as DOCX and Markdown.

**Architecture:** One new route (`/career-story`) following the endpoint-owned-inputs pattern. The prompt builder assembles context from every non-null session output (careers, gap analysis, board review, Odyssey lives, etc.) alongside the profile. One LLM call returns JSON with `{ themes, narrative }`. DOCX export via the existing `docx` package. Quiet nudge links on gap analysis, learning path, board, and Odyssey result views.

**Tech Stack:** Next.js 14 App Router, Zustand, Vitest, `docx`, `lucide-react` (`BookOpen`), `react-hot-toast`.

**Spec:** `docs/superpowers/specs/2026-04-16-f15-career-story-design.md`

---

## File Structure

**New files:**
- `lib/prompts/career-story.ts` + `lib/prompts/career-story.test.ts`
- `app/api/careerStory/route.ts`
- `app/career-story/page.tsx`
- `components/career-story/CareerStoryInputCard.tsx`
- `components/career-story/CareerStoryResultView.tsx`
- `components/career-story/career-story-docx.ts`

**Modified files:**
- `lib/session-store.ts` + `lib/session-store.test.ts`
- `lib/markdown-export.ts` + `lib/markdown-export.test.ts`
- `components/landing/ActionCards.tsx` — add Career story card to Reflect
- `components/landing/SessionBanner.tsx` — add career story link
- `components/results/GapAnalysisView.tsx` — add nudge link
- `components/results/LearningPathView.tsx` — add nudge link
- `app/board/page.tsx` — add nudge link
- `app/odyssey/page.tsx` — add nudge link

---

## Task 1: Session store — CareerStory types, field, action

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
describe('career story', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('careerStory initialises null', () => {
    expect(useSessionStore.getState().careerStory).toBeNull();
  });

  it('setCareerStory writes and clears', () => {
    const story = {
      themes: [{ name: 'Data-driven', evidence: ['Resume shows SQL'], reflectionQuestion: 'Is this your core?' }],
      narrative: 'I have always been drawn to data.',
    };
    useSessionStore.getState().setCareerStory(story);
    expect(useSessionStore.getState().careerStory).toEqual(story);
    useSessionStore.getState().setCareerStory(null);
    expect(useSessionStore.getState().careerStory).toBeNull();
  });

  it('reset() clears careerStory', () => {
    useSessionStore.getState().setCareerStory({
      themes: [{ name: 't', evidence: [], reflectionQuestion: 'q' }],
      narrative: 'n',
    });
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().careerStory).toBeNull();
  });

  it('resetOutputs() clears careerStory but preserves inputs', () => {
    useSessionStore.getState().setCareerStory({
      themes: [{ name: 't', evidence: [], reflectionQuestion: 'q' }],
      narrative: 'n',
    });
    useSessionStore.getState().setResume('r', 'r.pdf');
    useSessionStore.getState().resetOutputs();
    expect(useSessionStore.getState().careerStory).toBeNull();
    expect(useSessionStore.getState().resumeText).toBe('r');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/session-store.test.ts` — expect FAIL.

- [ ] **Step 3: Add types, field, and action**

Add types above `SessionState`:

```ts
export type CareerTheme = {
  name: string;
  evidence: string[];
  reflectionQuestion: string;
};

export type CareerStory = {
  themes: CareerTheme[];
  narrative: string;
};
```

Add to `SessionState`:

```ts
  // Career Story
  careerStory: CareerStory | null;
```

Add action:

```ts
  setCareerStory: (s: CareerStory | null) => void;
```

Add to `initialState`:

```ts
  careerStory: null,
```

Add implementation:

```ts
  setCareerStory: (s) => set({ careerStory: s }),
```

- [ ] **Step 4:** Run `npx vitest run lib/session-store.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add CareerTheme, CareerStory types and action"
```

---

## Task 2: Prompt builder + parser (TDD)

**Files:**
- Create: `lib/prompts/career-story.ts`
- Create: `lib/prompts/career-story.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/prompts/career-story.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCareerStoryPrompt, parseCareerStory } from './career-story';

describe('buildCareerStoryPrompt', () => {
  it('includes resume when provided', () => {
    const out = buildCareerStoryPrompt({ resume: 'Three years at Curtin.' });
    expect(out).toContain('Curtin');
  });

  it('includes about-me when provided', () => {
    const out = buildCareerStoryPrompt({ resume: 'r', freeText: 'I enjoy data work.' });
    expect(out).toContain('data work');
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
      typicalWeek: [], toolsAndSkills: [], whoYouWorkWith: null, challenges: [],
      questionsToExplore: [], dashboard: { resources: null, likability: null, confidence: null, coherence: null },
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
    expect(out.themes[0].reflectionQuestion).toContain('data');
    expect(out.narrative).toContain('making sense');
  });

  it('strips code fences', () => {
    const out = parseCareerStory('```json\n' + happy + '\n```');
    expect(out.themes).toHaveLength(2);
  });

  it('throws on missing narrative', () => {
    expect(() => parseCareerStory(JSON.stringify({
      themes: [{ name: 'n', evidence: [], reflectionQuestion: 'q' }],
    }))).toThrow(/narrative/i);
  });

  it('throws on zero themes', () => {
    expect(() => parseCareerStory(JSON.stringify({
      themes: [],
      narrative: 'n',
    }))).toThrow(/theme/i);
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
```

- [ ] **Step 2:** Run `npx vitest run lib/prompts/career-story.test.ts` — expect FAIL.

- [ ] **Step 3: Implement `lib/prompts/career-story.ts`**

```ts
import type {
  StudentProfile,
  CareerTheme,
  GapAnalysis,
  LearningPath,
  BoardReview,
  OdysseyLife,
  OdysseyLifeType,
  Comparison,
  ElevatorPitch,
  CoverLetter,
  ResumeReview,
  InterviewFeedback,
} from '@/lib/session-store';
import type { finalCareerInfo } from '@/lib/types';

export type CareerStoryInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
  careers?: finalCareerInfo[];
  gapAnalysis?: GapAnalysis;
  learningPath?: LearningPath;
  boardReview?: BoardReview;
  odysseyLives?: Record<OdysseyLifeType, OdysseyLife>;
  comparison?: Comparison;
  elevatorPitch?: ElevatorPitch;
  coverLetter?: CoverLetter;
  resumeReview?: ResumeReview;
  interviewFeedback?: InterviewFeedback;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildSessionContext(input: CareerStoryInput): string {
  const sections: string[] = [];

  if (input.careers && input.careers.length > 0) {
    const titles = input.careers.map((c) => c.jobTitle).join(', ');
    const details = input.careers.map((c) =>
      `- ${c.jobTitle}: ${c.jobDescription} (${c.salary}, ${c.difficulty} difficulty)`
    ).join('\n');
    sections.push(`<careers>\nGenerated career paths: ${titles}\n${details}\n</careers>`);
  }

  if (input.gapAnalysis) {
    const g = input.gapAnalysis;
    const gapList = g.gaps.map((gap) => `- ${gap.title} (${gap.severity}): ${gap.why}`).join('\n');
    sections.push(`<gapAnalysis>\nGap analysis for ${g.target}:\nSummary: ${g.summary}\nMatches: ${g.matches.join(', ')}\nGaps:\n${gapList}\nTimeline: ${g.realisticTimeline}\n</gapAnalysis>`);
  }

  if (input.learningPath) {
    const lp = input.learningPath;
    const milestones = lp.milestones.map((m) => `- ${m.weekRange}: ${m.focus}`).join('\n');
    sections.push(`<learningPath>\nLearning path for ${lp.target}:\nSummary: ${lp.summary}\nDuration: ${lp.totalDuration}\nMilestones:\n${milestones}\n</learningPath>`);
  }

  if (input.boardReview) {
    const b = input.boardReview;
    const voices = b.voices.map((v) => `${v.name}: ${v.response}`).join('\n');
    const synth = [
      b.synthesis.agreements.length > 0 ? `Agreed: ${b.synthesis.agreements.join('; ')}` : '',
      b.synthesis.disagreements.length > 0 ? `Disagreed: ${b.synthesis.disagreements.join('; ')}` : '',
      b.synthesis.topPriorities.length > 0 ? `Priorities: ${b.synthesis.topPriorities.join('; ')}` : '',
    ].filter(Boolean).join('\n');
    sections.push(`<boardReview>\n${voices}\n${synth}\n</boardReview>`);
  }

  if (input.odysseyLives) {
    const lives = (['current', 'pivot', 'wildcard'] as OdysseyLifeType[]).map((type) => {
      const life = input.odysseyLives![type];
      if (!life.label && !life.headline) return '';
      const parts = [`Life (${type}): ${life.label}`];
      if (life.headline) parts.push(`Headline: ${life.headline}`);
      if (life.dashboard) {
        const d = life.dashboard;
        const rated = Object.entries(d).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}/5`).join(', ');
        if (rated) parts.push(`Dashboard: ${rated}`);
      }
      return parts.join('\n');
    }).filter(Boolean).join('\n\n');
    if (lives) sections.push(`<odysseyLives>\n${lives}\n</odysseyLives>`);
  }

  if (input.comparison) {
    const c = input.comparison;
    const roles = c.roles.map((r) => r.label).join(', ');
    sections.push(`<comparison>\nCompared (${c.mode} mode): ${roles}\n</comparison>`);
  }

  if (input.elevatorPitch) {
    sections.push(`<elevatorPitch>\nTarget: ${input.elevatorPitch.target ?? 'General'}\nScript: ${input.elevatorPitch.fullScript}\n</elevatorPitch>`);
  }

  if (input.coverLetter) {
    sections.push(`<coverLetter>\nTarget: ${input.coverLetter.target}\nLetter excerpt: ${input.coverLetter.body.slice(0, 500)}\n</coverLetter>`);
  }

  if (input.resumeReview) {
    const r = input.resumeReview;
    const imps = r.improvements.map((i) => `- ${i.section}: ${i.suggestion}`).join('\n');
    sections.push(`<resumeReview>\nImpression: ${r.overallImpression}\nStrengths: ${r.strengths.join(', ')}\nImprovements:\n${imps}\n</resumeReview>`);
  }

  if (input.interviewFeedback) {
    const f = input.interviewFeedback;
    sections.push(`<interviewFeedback>\nTarget: ${f.target}\nRating: ${f.overallRating}\nSummary: ${f.summary}\nStrengths: ${f.strengths.join(', ')}\n</interviewFeedback>`);
  }

  if (sections.length === 0) return '';
  return `<sessionData>\n\n${sections.join('\n\n')}\n\n</sessionData>`;
}

export function buildCareerStoryPrompt(input: CareerStoryInput): string {
  const sections: string[] = [];

  sections.push(
    'You are helping a student discover the narrative thread that connects their experiences, interests, and goals. This is a Career Construction Theory exercise — the student may not see the patterns in their own history, and your job is to name them.'
  );

  sections.push(
    'Read ALL of the student\'s data below. This may include their resume, profile, generated career paths, gap analysis results, learning path, board of advisors feedback, Odyssey Plan lives, career comparison, elevator pitch, cover letter, resume review, and interview feedback. Use everything that is provided.'
  );

  sections.push(
    `Produce two things:

1. Themes — identify 3-5 recurring themes that appear across the student's data. Each theme should have:
   - A short, evocative name (2-5 words)
   - Evidence: 2-4 bullet points showing where this theme appears in the student's data
   - A reflection question the student can sit with

2. Narrative — a 2-4 paragraph first-person story that weaves the themes together. Written as if the student is telling their own story. Conversational but professional. Should feel like an insight, not a summary.

Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "themes": [
    {
      "name": string,
      "evidence": string[],
      "reflectionQuestion": string
    }
  ],
  "narrative": string (paragraphs separated by \\n\\n)
}`
  );

  // Profile
  const profileParts: string[] = [];
  if (input.resume?.trim()) profileParts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText?.trim()) profileParts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle?.trim()) profileParts.push(`Target job title: ${input.jobTitle.trim()}`);
  if (input.jobAdvert?.trim()) profileParts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) profileParts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (profileParts.length > 0) {
    sections.push(`<profile>\n${profileParts.join('\n\n')}\n</profile>`);
  }

  // Session context
  const sessionCtx = buildSessionContext(input);
  if (sessionCtx) sections.push(sessionCtx);

  sections.push('ONLY respond with JSON. No prose, no code fences.');

  return sections.join('\n\n');
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export function parseCareerStory(raw: string): { themes: CareerTheme[]; narrative: string } {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parseCareerStory: not an object');

  if (typeof parsed.narrative !== 'string' || !parsed.narrative.trim()) {
    throw new Error('parseCareerStory: missing narrative');
  }

  if (!Array.isArray(parsed.themes) || parsed.themes.length === 0) {
    throw new Error('parseCareerStory: needs at least one theme');
  }

  const themes: CareerTheme[] = parsed.themes.map((t: any, i: number) => {
    if (!t || typeof t !== 'object') throw new Error(`parseCareerStory: theme ${i} is not an object`);
    const name = typeof t.name === 'string' ? t.name.trim() : '';
    if (!name) throw new Error(`parseCareerStory: theme ${i} has empty name`);
    return {
      name,
      evidence: toStringArray(t.evidence),
      reflectionQuestion: typeof t.reflectionQuestion === 'string' ? t.reflectionQuestion.trim() : '',
    };
  });

  return { themes, narrative: parsed.narrative.trim() };
}
```

- [ ] **Step 4:** Run `npx vitest run lib/prompts/career-story.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/career-story.ts lib/prompts/career-story.test.ts
git commit -m "feat(career-story): add buildCareerStoryPrompt and parseCareerStory"
```

---

## Task 3: Markdown export (TDD)

**Files:**
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/markdown-export.test.ts`:

```ts
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
```

- [ ] **Step 2:** Run `npx vitest run lib/markdown-export.test.ts` — expect FAIL.

- [ ] **Step 3: Add `careerStoryToMarkdown`**

Add `CareerStory, CareerTheme` to the import from `./session-store`. Append:

```ts
export function careerStoryToMarkdown(s: CareerStory): string {
  const lines: string[] = [];
  lines.push('# My Career Story');
  lines.push('');
  lines.push('## The narrative');
  lines.push(s.narrative);
  lines.push('');
  lines.push('## Themes');
  lines.push('');
  s.themes.forEach((t, i) => {
    lines.push(`### ${i + 1}. ${t.name}`);
    if (t.evidence.length > 0) {
      lines.push('**Evidence:**');
      for (const e of t.evidence) lines.push(`- ${e}`);
    }
    if (t.reflectionQuestion) {
      lines.push('');
      lines.push(`*${t.reflectionQuestion}*`);
    }
    lines.push('');
  });
  lines.push('---');
  lines.push('');
  lines.push('*AI-generated career story. The themes are real patterns from your data. The narrative is a starting point — edit it to match your voice.*');
  return lines.join('\n');
}
```

- [ ] **Step 4:** Run `npx vitest run lib/markdown-export.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "feat(export): add careerStoryToMarkdown"
```

---

## Task 4: API route + DOCX export

**Files:**
- Create: `app/api/careerStory/route.ts`
- Create: `components/career-story/career-story-docx.ts`

- [ ] **Step 1: Create the API route**

The career story route is unique: it sends ALL session outputs as context. Trim-retry order: trim session outputs first (comparison → boardReview → odysseyLives → careers → gapAnalysis → learningPath), then jobAdvert, then resume.

For simplicity, the route accepts the full session snapshot. The client sends everything non-null.

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildCareerStoryPrompt, parseCareerStory, type CareerStoryInput } from '@/lib/prompts/career-story';
import { isTokenLimitError } from '@/lib/token-limit';

interface CareerStoryRequest extends CareerStoryInput {
  llmConfig?: LLMConfig;
}

const SYSTEM = 'You identify career themes and write narrative career stories. You ONLY respond in JSON.';

function trimSessionOutputs(input: CareerStoryInput): CareerStoryInput {
  return {
    ...input,
    comparison: undefined,
    boardReview: undefined,
    odysseyLives: undefined,
    careers: undefined,
    gapAnalysis: undefined,
    learningPath: undefined,
    elevatorPitch: undefined,
    coverLetter: undefined,
    resumeReview: undefined,
    interviewFeedback: undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as CareerStoryRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.freeText && input.freeText.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({ error: 'Career story needs a resume or About you to build from.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCareerStoryPrompt(input) }],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      // First trim: drop all session outputs, keep profile
      const lighter = trimSessionOutputs(input);
      try {
        raw = await provider.createCompletion(
          [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCareerStoryPrompt(lighter) }],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        // Second trim: also trim jobAdvert and resume
        const lightest = {
          ...lighter,
          jobAdvert: lighter.jobAdvert?.slice(0, 4000),
          resume: lighter.resume?.slice(0, 4000),
        };
        try {
          raw = await provider.createCompletion(
            [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCareerStoryPrompt(lightest) }],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({ error: 'Too much session data to process. Try with fewer features completed.' }),
            { status: 500 }
          );
        }
      }
    }

    const story = parseCareerStory(raw!);
    return new Response(JSON.stringify({ story, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[careerStory] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create the DOCX export**

```ts
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { CareerStory } from '@/lib/session-store';

export async function careerStoryToDocx(story: CareerStory): Promise<Blob> {
  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: 'My Career Story', bold: true, size: 32, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }));

  children.push(new Paragraph({
    children: [new TextRun({ text: 'Generated from your Career Compass session', italics: true, size: 20, font: 'Calibri', color: '666666' })],
    spacing: { after: 400 },
  }));

  // Narrative paragraphs
  const narrativeParagraphs = story.narrative.split('\n\n').filter(Boolean);
  for (const text of narrativeParagraphs) {
    children.push(new Paragraph({
      children: [new TextRun({ text, size: 24, font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  // Themes heading
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Themes', bold: true, size: 28, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
  }));

  for (const theme of story.themes) {
    // Theme name
    children.push(new Paragraph({
      children: [new TextRun({ text: theme.name, bold: true, size: 24, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 },
    }));

    // Evidence label
    if (theme.evidence.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Evidence:', bold: true, size: 22, font: 'Calibri' })],
        spacing: { after: 50 },
      }));

      for (const e of theme.evidence) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `  •  ${e}`, size: 22, font: 'Calibri' })],
          spacing: { after: 50 },
        }));
      }
    }

    // Reflection question
    if (theme.reflectionQuestion) {
      children.push(new Paragraph({
        children: [new TextRun({ text: theme.reflectionQuestion, italics: true, size: 22, font: 'Calibri', color: '555555' })],
        spacing: { before: 100, after: 200 },
      }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
```

- [ ] **Step 3:** Run `npx tsc --noEmit` — expect clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/careerStory/route.ts components/career-story/career-story-docx.ts
git commit -m "feat(career-story): add API route with session-aware trim-retry and DOCX export"
```

---

## Task 5: Input card + result view + page

**Files:**
- Create: `components/career-story/CareerStoryInputCard.tsx`
- Create: `components/career-story/CareerStoryResultView.tsx`
- Create: `app/career-story/page.tsx`

- [ ] **Step 1: Create CareerStoryInputCard**

Same pattern as `PortfolioInputCard`. Fields: Resume, About you, Job title (optional), Job advert (optional). All pre-filled.

Prominent helper note (styled like the compare "quick is vague" helper):

```tsx
<div className='border-l-2 border-accent p-4 bg-paper-warm mb-6 mt-4'>
  <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
    This works best when you have explored other features first. The career story draws on
    everything in your session: your generated careers, gap analysis, Odyssey lives, board
    review, and more. The more you have done, the richer the story.
  </p>
</div>
```

Run button: "Build my career story" with `BookOpen` icon. Gate: at least one of resume or freeText.

On run: POST `/api/careerStory` with profile fields + ALL non-null session outputs from the store:

```ts
const state = useSessionStore.getState();
body: JSON.stringify({
  resume: store.resumeText ?? undefined,
  freeText: store.freeText || undefined,
  jobTitle: store.jobTitle || undefined,
  jobAdvert: store.jobAdvert || undefined,
  distilledProfile: store.distilledProfile ?? undefined,
  careers: state.careers ?? undefined,
  gapAnalysis: state.gapAnalysis ?? undefined,
  learningPath: state.learningPath ?? undefined,
  boardReview: state.boardReview ?? undefined,
  odysseyLives: state.odysseyLives,
  comparison: state.comparison ?? undefined,
  elevatorPitch: state.elevatorPitch ?? undefined,
  coverLetter: state.coverLetter ?? undefined,
  resumeReview: state.resumeReview ?? undefined,
  interviewFeedback: state.interviewFeedback ?? undefined,
  llmConfig,
})
```

On success: `store.setCareerStory(story)`.

- [ ] **Step 2: Create CareerStoryResultView**

Props: `{ story: CareerStory }`.

Layout: narrative first (paragraphs split by `\n\n`), editorial-rule divider, themes below as cards (non-collapsible — only 3-5 themes). Each theme card: name as heading, evidence as bullets, reflection question in italics.

```tsx
// Narrative
<div className='prose max-w-none'>
  {story.narrative.split('\n\n').filter(Boolean).map((p, i) => (
    <p key={i} className='text-ink leading-relaxed mb-4'>{p}</p>
  ))}
</div>

// Divider
<div className='editorial-rule justify-center my-8'>
  <span>Themes we found</span>
</div>

// Theme cards
<div className='space-y-4'>
  {story.themes.map((theme, i) => (
    <div key={i} className='border border-border rounded-lg bg-paper p-5'>
      <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>{theme.name}</h3>
      {theme.evidence.length > 0 && (
        <ul className='space-y-1 text-ink-muted mb-3'>
          {theme.evidence.map((e, j) => (
            <li key={j} className='flex gap-2'>
              <span className='text-accent flex-shrink-0'>·</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}
      {theme.reflectionQuestion && (
        <p className='text-ink-quiet italic text-[var(--text-sm)]'>{theme.reflectionQuestion}</p>
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 3: Create the page orchestrator**

Same three-state pattern. Page shell: Back to landing + Start over. When story exists: + CopyMarkdownButton + Save as DOCX + "Build another".

Auto-run: mount-only `[]` dependency with `autoRanRef` + `useSessionStore.getState()`. Checks: `hasProfile && !careerStory`. Sends all session outputs.

Save as DOCX handler:

```ts
async function handleSaveDocx() {
  if (!careerStory) return;
  try {
    const blob = await careerStoryToDocx(careerStory);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-career-story.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Career story saved as DOCX');
  } catch (err) {
    console.error(err);
    toast.error('Could not create the document. Copy as Markdown instead.');
  }
}
```

- [ ] **Step 4:** Run `npx tsc --noEmit` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add components/career-story/CareerStoryInputCard.tsx components/career-story/CareerStoryResultView.tsx app/career-story/page.tsx
git commit -m "feat(career-story): add input card, result view, and /career-story page"
```

---

## Task 6: Landing + SessionBanner + nudge links

**Files:**
- Modify: `components/landing/ActionCards.tsx`
- Modify: `components/landing/SessionBanner.tsx`
- Modify: `components/results/GapAnalysisView.tsx`
- Modify: `components/results/LearningPathView.tsx`
- Modify: `app/board/page.tsx`
- Modify: `app/odyssey/page.tsx`

- [ ] **Step 1: Add Career story card to Reflect pillar**

In `ActionCards.tsx`, add `BookOpen` to lucide import. Add third card to `reflect` array:

```ts
{
  icon: <BookOpen className='w-5 h-5' />,
  title: 'Career story',
  description: 'Find the thread connecting your experiences.',
  hover: 'Works best after using other features. Draws on your full session.',
  path: '/career-story',
},
```

- [ ] **Step 2: Add career story link to SessionBanner**

In `SessionBanner.tsx`, add `careerStory` to store destructure. Add:

```ts
const hasCareerStory = !!careerStory;
```

Add to `hasAnyOutput`. Add link:

```tsx
{hasCareerStory && (
  <Link href='/career-story' className='underline hover:text-accent'>
    career story ready
  </Link>
)}
```

- [ ] **Step 3: Add nudge links to result views**

Add to the bottom of `GapAnalysisView.tsx` (after the chain buttons row):

```tsx
<p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
  Ready to see the bigger picture?{' '}
  <Link href='/career-story' className='underline hover:text-accent'>
    Build your career story
  </Link>
</p>
```

Import `Link` from `next/link` if not already imported.

Same nudge added to:
- `LearningPathView.tsx` (after chain buttons)
- `app/board/page.tsx` (in the result view, after `BoardSynthesisPanel`)
- `app/odyssey/page.tsx` (after the card/compare views, before the closing div)

For `board/page.tsx` and `odyssey/page.tsx`, add the nudge inside the result-view conditional. Read each file first to find the right insertion point.

- [ ] **Step 4:** Run `npx tsc --noEmit && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add components/landing/ActionCards.tsx components/landing/SessionBanner.tsx components/results/GapAnalysisView.tsx components/results/LearningPathView.tsx app/board/page.tsx app/odyssey/page.tsx
git commit -m "feat(career-story): add landing card, session banner, and nudge links"
```

---

## Task 7: Manual QA

- [ ] **Step 1:** `npx vitest run` — all green.
- [ ] **Step 2:** `npm run electron:dev`
- [ ] **Step 3:** Walk QA checklist from spec.
- [ ] **Step 4:** Fix any findings.

---

## Notes for the implementer

- **The prompt builder assembles session context dynamically.** Each non-null session output gets its own XML-tagged section. If nothing exists, the `<sessionData>` block is omitted entirely.
- **Trim-retry is session-aware.** First trim drops ALL session outputs (comparison, board, odyssey, careers, gap, learning, pitch, cover letter, resume review, interview feedback). This is aggressive but preserves the primary profile data. Second trim also shortens jobAdvert and resume.
- **The auto-run sends the full session snapshot.** Use `useSessionStore.getState()` inside the mount-only effect to get a one-time snapshot. Don't subscribe reactively.
- **Theme cards are NOT collapsible.** There are only 3-5. The student should see them all without clicking.
- **The DOCX uses `HeadingLevel` from the `docx` package.** Heading 1 for title, Heading 2 for "Themes", Heading 3 for each theme name. This gives the document proper structure that survives copy-paste into Google Docs.
- **Nudge links are text links, not buttons.** Small, quiet, positioned at the bottom of result views. They should not compete with the existing chain buttons.
- **`odysseyLives` is always sent** (it's a Record, not nullable). The prompt builder checks each life for content (label or headline) before including it.
