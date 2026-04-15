# F12 Board of Advisors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Board of Advisors reviewer — four named advisor personas (Recruiter / HR / Hiring Manager / Mentor) give voiced feedback on the student's profile in one LLM call, followed by a board-level synthesis (agreements / disagreements / priorities).

**Architecture:** New `/board` route with input view → review view driven by presence of `boardReview` in the session store. One thin API route (`/api/board`) delegates to a pure prompt builder/parser. Landing Reflect group gains a second button; chat chain and career-card shortcut both pre-fill inputs via a new read-and-clear `boardPrefill` session transient.

**Tech Stack:** Next.js 14 App Router, Zustand session store, Vitest for pure-function tests, Studio Calm design tokens, `react-hot-toast`, `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-04-15-f12-board-of-advisors-design.md` — the canonical source for prompts, types, UI, and scope.

---

## File Structure

**New files:**
- `lib/prompts/board.ts` — prompt builder + parser
- `lib/prompts/board.test.ts`
- `app/api/board/route.ts`
- `app/board/page.tsx`
- `components/board/BoardInputCard.tsx`
- `components/board/BoardVoices.tsx`
- `components/board/BoardSynthesisPanel.tsx`

**Modified files:**
- `lib/session-store.ts` — `BoardAdvisorRole`, `BoardAdvisorVoice`, `BoardSynthesis`, `BoardReview`, `BoardPrefill` types, `boardReview` and `boardPrefill` fields, `setBoardReview` / `setBoardPrefill` / `consumeBoardPrefill` actions
- `lib/session-store.test.ts` — extended tests
- `lib/markdown-export.ts` — `boardReviewToMarkdown`
- `lib/markdown-export.test.ts` — extended tests
- `components/landing/ActionsZone.tsx` — add "Board of advisors" button to Reflect group
- `components/landing/OutputsBanner.tsx` — add board review quick-jump link
- `components/chat/ChatComposer.tsx` — optional `onBoard` chain button
- `app/chat/page.tsx` — `handleBoard` handler reusing `/api/distillProfile`
- `components/CareerNode.tsx` — "Ask the board about this role" shortcut

---

## Task 1: Session store — Board types, state, actions

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
describe('board review', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('boardReview and boardPrefill initialise null', () => {
    expect(useSessionStore.getState().boardReview).toBeNull();
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });

  it('setBoardReview writes and clears', () => {
    const review = {
      framing: 'I want to know if my profile reads industry-ready.',
      focusRole: 'Data analyst',
      voices: [
        { role: 'recruiter' as const, name: 'The Recruiter', response: 'r' },
        { role: 'hr' as const, name: 'The HR Partner', response: 'h' },
        { role: 'manager' as const, name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor' as const, name: 'The Mentor', response: 'me' },
      ],
      synthesis: {
        agreements: ['a1'],
        disagreements: ['d1'],
        topPriorities: ['p1', 'p2'],
      },
    };
    useSessionStore.getState().setBoardReview(review);
    expect(useSessionStore.getState().boardReview).toEqual(review);
    useSessionStore.getState().setBoardReview(null);
    expect(useSessionStore.getState().boardReview).toBeNull();
  });

  it('setBoardPrefill writes', () => {
    useSessionStore.getState().setBoardPrefill({ framing: 'F', focusRole: 'R' });
    expect(useSessionStore.getState().boardPrefill).toEqual({ framing: 'F', focusRole: 'R' });
  });

  it('consumeBoardPrefill reads and clears atomically', () => {
    useSessionStore.getState().setBoardPrefill({ framing: 'Read me' });
    const first = useSessionStore.getState().consumeBoardPrefill();
    expect(first).toEqual({ framing: 'Read me' });
    const second = useSessionStore.getState().consumeBoardPrefill();
    expect(second).toBeNull();
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });

  it('consumeBoardPrefill returns null when nothing set', () => {
    expect(useSessionStore.getState().consumeBoardPrefill()).toBeNull();
  });

  it('reset() clears boardReview and boardPrefill', () => {
    useSessionStore.getState().setBoardReview({
      framing: 'x',
      focusRole: null,
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: ['a'], disagreements: [], topPriorities: [] },
    });
    useSessionStore.getState().setBoardPrefill({ framing: 'F' });
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().boardReview).toBeNull();
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });
});
```

Only add `beforeEach` to the imports if it is missing from the existing file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/session-store.test.ts`
Expected: FAIL — `boardReview`, `setBoardReview`, etc. do not exist.

- [ ] **Step 3: Add types, state, and actions to `lib/session-store.ts`**

Add these types above `SessionState`:

```ts
export type BoardAdvisorRole = 'recruiter' | 'hr' | 'manager' | 'mentor';

export type BoardAdvisorVoice = {
  role: BoardAdvisorRole;
  name: string;
  response: string;
};

export type BoardSynthesis = {
  agreements: string[];
  disagreements: string[];
  topPriorities: string[];
};

export type BoardReview = {
  framing: string;
  focusRole: string | null;
  voices: BoardAdvisorVoice[];
  synthesis: BoardSynthesis;
};

export type BoardPrefill = {
  framing?: string;
  focusRole?: string;
};
```

Add to `SessionState` (near `// Outputs`):

```ts
  // Board
  boardReview: BoardReview | null;
  boardPrefill: BoardPrefill | null;
```

Add to the actions section of `SessionState`:

```ts
  setBoardReview: (r: BoardReview | null) => void;
  setBoardPrefill: (p: BoardPrefill | null) => void;
  consumeBoardPrefill: () => BoardPrefill | null;
```

Add to `initialState`:

```ts
  boardReview: null,
  boardPrefill: null,
```

Add action implementations inside `create<SessionState>((set, get) => (...))`. The store currently uses `set` only — update the factory signature to `(set, get) =>` if it isn't already, so `consumeBoardPrefill` can read the current state. Zustand's `create` passes `(set, get)` as the first-arg signature:

```ts
  setBoardReview: (r) => set({ boardReview: r }),
  setBoardPrefill: (p) => set({ boardPrefill: p }),
  consumeBoardPrefill: () => {
    const current = get().boardPrefill;
    if (current) set({ boardPrefill: null });
    return current;
  },
```

If the existing file uses `create<SessionState>((set) => ({...}))` without `get`, change it to `create<SessionState>((set, get) => ({...}))`. This change is backwards-compatible — every existing action keeps working.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/session-store.test.ts`
Expected: PASS — all new board tests plus all prior tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add BoardReview types, boardPrefill transient, and actions"
```

---

## Task 2: `lib/prompts/board.ts` — prompt builder and parser

**Files:**
- Create: `lib/prompts/board.ts`
- Create: `lib/prompts/board.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/prompts/board.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildBoardPrompt, parseBoardReview } from './board';

describe('buildBoardPrompt', () => {
  const base = {
    framing: '',
    focusRole: null,
    resume: 'Third-year public health student at Curtin.',
  };

  it('includes all four advisor personas', () => {
    const out = buildBoardPrompt(base);
    expect(out).toMatch(/The Recruiter/);
    expect(out).toMatch(/The HR Partner/);
    expect(out).toMatch(/The Hiring Manager/);
    expect(out).toMatch(/The Mentor/);
  });

  it('asks for the voices + synthesis JSON shape', () => {
    const out = buildBoardPrompt(base);
    expect(out).toMatch(/"voices"/);
    expect(out).toMatch(/"synthesis"/);
    expect(out).toMatch(/"agreements"/);
    expect(out).toMatch(/"disagreements"/);
    expect(out).toMatch(/"topPriorities"/);
    for (const role of ['recruiter', 'hr', 'manager', 'mentor']) {
      expect(out).toContain(`"${role}"`);
    }
  });

  it('includes profile when provided', () => {
    const out = buildBoardPrompt(base);
    expect(out).toContain('Curtin');
  });

  it('includes framing block when framing is non-empty', () => {
    const out = buildBoardPrompt({ ...base, framing: 'I feel too academic for industry.' });
    expect(out).toContain('<framing>');
    expect(out).toContain('I feel too academic for industry.');
  });

  it('omits framing block when framing is empty', () => {
    const out = buildBoardPrompt({ ...base, framing: '' });
    expect(out).not.toContain('<framing>');
  });

  it('omits framing block when framing is whitespace-only', () => {
    const out = buildBoardPrompt({ ...base, framing: '   ' });
    expect(out).not.toContain('<framing>');
  });

  it('includes focus role block when non-null', () => {
    const out = buildBoardPrompt({ ...base, focusRole: 'Graduate data analyst' });
    expect(out).toContain('<focusRole>');
    expect(out).toContain('Graduate data analyst');
  });

  it('omits focus role block when null', () => {
    const out = buildBoardPrompt(base);
    expect(out).not.toContain('<focusRole>');
  });

  it('includes distilled profile when provided', () => {
    const out = buildBoardPrompt({
      framing: '',
      focusRole: null,
      distilledProfile: {
        background: 'Nursing undergrad',
        interests: ['public health'],
        skills: ['patient communication'],
        constraints: [],
        goals: ['community health role'],
      },
    });
    expect(out).toMatch(/nursing undergrad/i);
    expect(out).toMatch(/public health/i);
  });

  it('includes jobAdvert when provided', () => {
    const out = buildBoardPrompt({
      framing: '',
      focusRole: null,
      resume: 'r',
      jobAdvert: 'We are hiring a Graduate Analyst...',
    });
    expect(out).toContain('Graduate Analyst');
  });
});

describe('parseBoardReview', () => {
  const happyPath = JSON.stringify({
    voices: [
      { role: 'recruiter', name: 'The Recruiter', response: 'Your resume needs keywords.' },
      { role: 'hr', name: 'The HR Partner', response: 'Culture fit seems strong.' },
      { role: 'manager', name: 'The Hiring Manager', response: 'I would probe your projects.' },
      { role: 'mentor', name: 'The Mentor', response: 'You have real curiosity.' },
    ],
    synthesis: {
      agreements: ['Strong curiosity signals'],
      disagreements: ['The Recruiter wants more keywords, but The Mentor sees depth'],
      topPriorities: ['Add concrete project outcomes', 'Reframe academic work in industry language'],
    },
  });

  it('parses happy path into voices + synthesis', () => {
    const out = parseBoardReview(happyPath);
    expect(out.voices).toHaveLength(4);
    expect(out.voices.map((v) => v.role)).toEqual(['recruiter', 'hr', 'manager', 'mentor']);
    expect(out.synthesis.agreements).toEqual(['Strong curiosity signals']);
    expect(out.synthesis.topPriorities).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const out = parseBoardReview('```json\n' + happyPath + '\n```');
    expect(out.voices).toHaveLength(4);
  });

  it('coerces voice order to canonical recruiter/hr/manager/mentor', () => {
    const scrambled = JSON.stringify({
      voices: [
        { role: 'mentor', name: 'The Mentor', response: 'me' },
        { role: 'manager', name: 'The Hiring Manager', response: 'ma' },
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
      ],
      synthesis: { agreements: ['x'], disagreements: [], topPriorities: [] },
    });
    const out = parseBoardReview(scrambled);
    expect(out.voices.map((v) => v.role)).toEqual(['recruiter', 'hr', 'manager', 'mentor']);
    expect(out.voices[0].response).toBe('r');
    expect(out.voices[3].response).toBe('me');
  });

  it('throws when a role is missing', () => {
    const broken = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
      ],
      synthesis: { agreements: ['x'], disagreements: [], topPriorities: [] },
    });
    expect(() => parseBoardReview(broken)).toThrow(/mentor/i);
  });

  it('throws when a voice response is empty', () => {
    const broken = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: '' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: ['x'], disagreements: [], topPriorities: [] },
    });
    expect(() => parseBoardReview(broken)).toThrow(/response/i);
  });

  it('coerces missing synthesis arrays to empty arrays', () => {
    const minimal = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: ['a'] },
    });
    const out = parseBoardReview(minimal);
    expect(out.synthesis.disagreements).toEqual([]);
    expect(out.synthesis.topPriorities).toEqual([]);
  });

  it('throws when all three synthesis arrays are empty', () => {
    const broken = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: [], disagreements: [], topPriorities: [] },
    });
    expect(() => parseBoardReview(broken)).toThrow(/synthesis/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prompts/board.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/prompts/board.ts`**

```ts
import type {
  StudentProfile,
  BoardAdvisorVoice,
  BoardAdvisorRole,
  BoardSynthesis,
} from '@/lib/session-store';

export type BoardInput = {
  framing: string;
  focusRole: string | null;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type ParsedBoard = {
  voices: BoardAdvisorVoice[];
  synthesis: BoardSynthesis;
};

const ROLE_ORDER: BoardAdvisorRole[] = ['recruiter', 'hr', 'manager', 'mentor'];

const ROLE_NAMES: Record<BoardAdvisorRole, string> = {
  recruiter: 'The Recruiter',
  hr: 'The HR Partner',
  manager: 'The Hiring Manager',
  mentor: 'The Mentor',
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

function buildProfileSection(input: BoardInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) parts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) parts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(No profile material provided.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildBoardPrompt(input: BoardInput): string {
  const sections: string[] = [];

  sections.push(
    `You are running a Board of Advisors review for a student. Four advisors each read the student's profile and share what they notice. The advisors have different personalities and will not always agree — that's the point.`
  );

  sections.push(
    `Advisor 1 — The Recruiter. Market-facing. Thinks about how this profile would land in an applicant tracking system and a recruiter's 30-second scan. Cares about keywords, positioning, resume format, and market signal. Direct and pragmatic.

Advisor 2 — The HR Partner. Thinks about culture fit, soft-skill signals, red flags, and what references would likely say. Reads between the lines. Thoughtful, careful tone.

Advisor 3 — The Hiring Manager. Thinks about whether they'd bet their team on this person. Cares about evidence of impact, problem-solving stories, and what they'd probe in an interview. Skeptical but fair.

Advisor 4 — The Mentor. A warm but honest career coach. Counterbalances the first three without sugar-coating. Names strengths the others might miss and suggests low-risk experiments. Encouraging but never dishonest.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "voices": [
    { "role": "recruiter", "name": "The Recruiter", "response": string (2-4 sentences in character) },
    { "role": "hr", "name": "The HR Partner", "response": string (2-4 sentences in character) },
    { "role": "manager", "name": "The Hiring Manager", "response": string (2-4 sentences in character) },
    { "role": "mentor", "name": "The Mentor", "response": string (2-4 sentences in character) }
  ],
  "synthesis": {
    "agreements": string[] (2-4 points where the board converged),
    "disagreements": string[] (1-3 points where advisors pushed back on each other — be specific about which advisor said what, e.g. "The Recruiter thought X, but The Mentor argued Y."),
    "topPriorities": string[] (2-3 things to work on, ordered most important first)
  }
}

Make the disagreements real. If the recruiter sees a weakness the mentor sees as a strength, name both sides. Students learn more from watching credible voices disagree than from a unified verdict.`
  );

  if (input.framing && input.framing.trim()) {
    sections.push(`<framing>\n${input.framing.trim()}\n</framing>`);
  }

  if (input.focusRole && input.focusRole.trim()) {
    sections.push(`<focusRole>\n${input.focusRole.trim()}\n</focusRole>`);
  }

  sections.push(buildProfileSection(input));

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

export function parseBoardReview(raw: string): ParsedBoard {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseBoardReview: not an object');
  }
  if (!Array.isArray(parsed.voices)) {
    throw new Error('parseBoardReview: voices must be an array');
  }

  const byRole = new Map<BoardAdvisorRole, BoardAdvisorVoice>();
  for (const raw of parsed.voices) {
    if (!raw || typeof raw !== 'object') continue;
    const role = raw.role as BoardAdvisorRole;
    if (!ROLE_ORDER.includes(role)) continue;
    const response = typeof raw.response === 'string' ? raw.response.trim() : '';
    if (!response) {
      throw new Error(`parseBoardReview: voice ${role} has empty response`);
    }
    byRole.set(role, {
      role,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : ROLE_NAMES[role],
      response,
    });
  }

  for (const role of ROLE_ORDER) {
    if (!byRole.has(role)) {
      throw new Error(`parseBoardReview: missing role ${role}`);
    }
  }

  const voices = ROLE_ORDER.map((role) => byRole.get(role)!);

  const synthRaw = (parsed.synthesis ?? {}) as Record<string, unknown>;
  const synthesis: BoardSynthesis = {
    agreements: toStringArray(synthRaw.agreements),
    disagreements: toStringArray(synthRaw.disagreements),
    topPriorities: toStringArray(synthRaw.topPriorities),
  };

  if (
    synthesis.agreements.length === 0 &&
    synthesis.disagreements.length === 0 &&
    synthesis.topPriorities.length === 0
  ) {
    throw new Error('parseBoardReview: synthesis must have at least one non-empty list');
  }

  return { voices, synthesis };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prompts/board.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/board.ts lib/prompts/board.test.ts
git commit -m "feat(board): add buildBoardPrompt and parseBoardReview"
```

---

## Task 3: `lib/markdown-export.ts` — `boardReviewToMarkdown`

**Files:**
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/markdown-export.test.ts`:

```ts
import { boardReviewToMarkdown } from './markdown-export';
import type { BoardReview } from './session-store';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/markdown-export.test.ts`
Expected: FAIL — `boardReviewToMarkdown` not exported.

- [ ] **Step 3: Add `boardReviewToMarkdown` to `lib/markdown-export.ts`**

Add `BoardReview` to the existing import from `./session-store`:

```ts
import type { GapAnalysis, LearningPath, InterviewFeedback, InterviewPhase, SourceRef, OdysseyLife, OdysseyLifeType, OdysseyDashboard, BoardReview } from './session-store';
```

Append to the bottom of the file:

```ts
export function boardReviewToMarkdown(r: BoardReview): string {
  const lines: string[] = [];
  lines.push('# Board of Advisors Review');
  lines.push('');
  const framingLine = r.framing.trim() || 'Open review — no specific focus';
  lines.push(`**Your framing:** ${framingLine}`);
  lines.push(`**Focus role:** ${r.focusRole?.trim() || 'None'}`);
  lines.push('');

  for (const voice of r.voices) {
    lines.push(`## ${voice.name}`);
    lines.push(voice.response);
    lines.push('');
  }

  lines.push('## Where the board landed');
  lines.push('');

  if (r.synthesis.agreements.length > 0) {
    lines.push('### Where they agreed');
    for (const a of r.synthesis.agreements) lines.push(`- ${a}`);
    lines.push('');
  }

  if (r.synthesis.disagreements.length > 0) {
    lines.push('### Where they pushed back on each other');
    for (const d of r.synthesis.disagreements) lines.push(`- ${d}`);
    lines.push('');
  }

  if (r.synthesis.topPriorities.length > 0) {
    lines.push('### What to work on');
    r.synthesis.topPriorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*Four AI-generated perspectives. Disagreement is part of the exercise.*');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/markdown-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "feat(export): add boardReviewToMarkdown"
```

---

## Task 4: `app/api/board/route.ts` — API route with trim-retry

**Files:**
- Create: `app/api/board/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildBoardPrompt, parseBoardReview, type BoardInput } from '@/lib/prompts/board';
import { isTokenLimitError } from '@/lib/token-limit';

interface BoardRequest extends BoardInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimAdvert(input: BoardInput): BoardInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: BoardInput): BoardInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM =
  'You are a Board of Advisors simulator producing voiced perspectives plus a synthesis. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as BoardRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.freeText && input.freeText.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({
          error: 'The board needs at least a resume, an About you, or a distilled profile to review.',
        }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;
    let current = input;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildBoardPrompt(current) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = trimAdvert(current);
      try {
        raw = await provider.createCompletion(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildBoardPrompt(current) },
          ],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        current = trimResume(current);
        try {
          raw = await provider.createCompletion(
            [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: buildBoardPrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({
              error: 'This profile is too long for the board to review. Try trimming your resume or About you.',
            }),
            { status: 500 }
          );
        }
      }
    }

    const parsed = parseBoardReview(raw!);
    const review = {
      framing: input.framing,
      focusRole: input.focusRole,
      voices: parsed.voices,
      synthesis: parsed.synthesis,
    };
    return new Response(JSON.stringify({ review, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[board] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/board/route.ts
git commit -m "feat(api): add /api/board with trim-retry on token limits"
```

---

## Task 5: `BoardVoices` component

**Files:**
- Create: `components/board/BoardVoices.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { BoardAdvisorRole, BoardAdvisorVoice } from '@/lib/session-store';

const TAGLINES: Record<BoardAdvisorRole, string> = {
  recruiter: 'Market-facing, keyword-scanning',
  hr: 'Culture and soft-signal reader',
  manager: 'Would they bet their team on you',
  mentor: 'Warm but honest coach',
};

type Props = {
  voices: BoardAdvisorVoice[];
};

export default function BoardVoices({ voices }: Props) {
  return (
    <div className='space-y-4'>
      {voices.map((v) => (
        <div
          key={v.role}
          className='border border-border border-l-4 border-l-accent/50 rounded-lg bg-paper p-5'
        >
          <h3 className='text-[var(--text-lg)] font-semibold text-ink'>{v.name}</h3>
          <p className='text-[var(--text-xs)] text-ink-quiet italic mb-3'>{TAGLINES[v.role]}</p>
          <p className='text-ink-muted leading-relaxed'>{v.response}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/board/BoardVoices.tsx
git commit -m "feat(board): add BoardVoices four-advisor stack"
```

---

## Task 6: `BoardSynthesisPanel` component

**Files:**
- Create: `components/board/BoardSynthesisPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { BoardSynthesis } from '@/lib/session-store';

type Props = {
  synthesis: BoardSynthesis;
};

export default function BoardSynthesisPanel({ synthesis }: Props) {
  return (
    <div className='mt-8'>
      <div className='editorial-rule justify-center mb-6'>
        <span>Where the board landed</span>
      </div>

      <div className='space-y-6'>
        {synthesis.agreements.length > 0 && (
          <div>
            <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>
              Where they agreed
            </h3>
            <ul className='space-y-1 text-ink-muted'>
              {synthesis.agreements.map((a, i) => (
                <li key={i} className='flex gap-2'>
                  <span className='text-accent flex-shrink-0'>·</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {synthesis.disagreements.length > 0 && (
          <div>
            <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>
              Where they pushed back on each other
            </h3>
            <ul className='space-y-1 text-ink-muted'>
              {synthesis.disagreements.map((d, i) => (
                <li key={i} className='flex gap-2'>
                  <span className='text-accent flex-shrink-0'>·</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {synthesis.topPriorities.length > 0 && (
          <div>
            <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>
              What to work on
            </h3>
            <ol className='space-y-1 text-ink-muted list-decimal list-inside'>
              {synthesis.topPriorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <p className='mt-8 text-[var(--text-xs)] text-ink-quiet italic text-center'>
        Four AI-generated perspectives. Disagreement is part of the exercise.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/board/BoardSynthesisPanel.tsx
git commit -m "feat(board): add BoardSynthesisPanel with agreements/disagreements/priorities"
```

---

## Task 7: `BoardInputCard` component

**Files:**
- Create: `components/board/BoardInputCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type BoardReview } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function BoardInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [framing, setFraming] = useState('');
  const [focusRole, setFocusRole] = useState('');
  const [convening, setConvening] = useState(false);

  useEffect(() => {
    const prefill = store.consumeBoardPrefill();
    if (prefill) {
      if (prefill.framing) setFraming(prefill.framing);
      if (prefill.focusRole) setFocusRole(prefill.focusRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasProfile =
    !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;

  const profileSummary: string[] = [];
  if (store.resumeText) profileSummary.push(`Resume: ${store.resumeFilename ?? 'uploaded'}`);
  if (store.freeText.trim()) profileSummary.push('About you: filled');
  if (store.distilledProfile) profileSummary.push('Distilled profile: yes');
  if (store.jobTitle.trim()) profileSummary.push(`Job title: ${store.jobTitle.trim()}`);
  if (store.jobAdvert.trim()) profileSummary.push('Job advert: pasted');

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return false;
    }
    return true;
  }

  async function runConvene() {
    if (!hasProfile) return;
    if (!(await ensureProvider())) return;

    setConvening(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framing,
          focusRole: focusRole.trim() || null,
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          jobTitle: store.jobTitle || undefined,
          jobAdvert: store.jobAdvert || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'The board could not be convened.');
      }
      const { review, trimmed } = (await res.json()) as {
        review: BoardReview;
        trimmed?: boolean;
      };
      store.setBoardReview(review);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "The board's response wasn't quite right. Try again — sometimes a second attempt works."
      );
    } finally {
      setConvening(false);
    }
  }

  return (
    <div className='border border-border rounded-lg bg-paper p-6'>
      <div className='editorial-rule justify-center mb-2'>
        <span>Board of advisors</span>
      </div>
      <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
        Four perspectives on your profile
      </h2>
      <p className='text-ink-muted text-center max-w-2xl mx-auto mb-6'>
        A recruiter, an HR partner, a hiring manager, and a mentor will each read your profile and
        share what they notice. They won&apos;t always agree — that&apos;s the point.
      </p>

      <div className='space-y-4'>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            What&apos;s on your mind? (optional)
          </label>
          <Textarea
            value={framing}
            rows={4}
            onChange={(e) => setFraming(e.target.value)}
            placeholder="e.g. I'm worried my degree feels too academic for industry data roles."
            disabled={convening}
          />
        </div>

        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            A specific role to centre on? (optional)
          </label>
          <Input
            value={focusRole}
            onChange={(e) => setFocusRole(e.target.value)}
            placeholder='Graduate data analyst'
            disabled={convening}
          />
        </div>

        <div className='text-[var(--text-sm)] text-ink-quiet'>
          {hasProfile ? (
            <>
              <span className='text-ink-muted'>Your profile:</span>{' '}
              {profileSummary.join('  ·  ')}
            </>
          ) : (
            <span className='text-error'>
              The board needs at least a resume, an About you, or a distilled profile to review. Add
              one on the landing page.
            </span>
          )}
        </div>

        <div className='flex justify-center pt-2'>
          <Button onClick={runConvene} disabled={!hasProfile || convening}>
            {convening ? (
              <>
                <LoadingDots color='white' /> Convening…
              </>
            ) : (
              <>
                <Users className='w-4 h-4 mr-2' />
                Convene the board
              </>
            )}
          </Button>
        </div>

        {convening && (
          <p className='text-[var(--text-sm)] text-ink-quiet text-center italic'>
            Four advisors are reading your profile…
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/board/BoardInputCard.tsx
git commit -m "feat(board): add BoardInputCard with framing, focus, and convene action"
```

---

## Task 8: `app/board/page.tsx` — orchestrator

**Files:**
- Create: `app/board/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import BoardInputCard from '@/components/board/BoardInputCard';
import BoardVoices from '@/components/board/BoardVoices';
import BoardSynthesisPanel from '@/components/board/BoardSynthesisPanel';
import { useSessionStore } from '@/lib/session-store';
import { boardReviewToMarkdown } from '@/lib/markdown-export';

export default function BoardPage() {
  const router = useRouter();
  const store = useSessionStore();
  const { boardReview } = store;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleRunAgain() {
    if (!boardReview) return;
    if (
      !confirm(
        'Run the board again? The current review will be cleared. Your framing and focus will be kept.'
      )
    ) {
      return;
    }
    store.setBoardPrefill({
      framing: boardReview.framing,
      focusRole: boardReview.focusRole ?? undefined,
    });
    store.setBoardReview(null);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-3xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {boardReview && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => boardReviewToMarkdown(boardReview)}
                  label='Copy as Markdown'
                />
                <Button variant='outline' onClick={handleRunAgain}>
                  Run again
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {!boardReview ? (
          <BoardInputCard />
        ) : (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Board review</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
              Four perspectives on your profile
            </h1>

            {(boardReview.framing.trim() || boardReview.focusRole) && (
              <div className='text-center text-[var(--text-sm)] text-ink-muted mb-8 space-y-1'>
                {boardReview.framing.trim() && (
                  <div>
                    <span className='text-ink-quiet'>Your framing:</span> {boardReview.framing}
                  </div>
                )}
                {boardReview.focusRole && (
                  <div>
                    <span className='text-ink-quiet'>Focus role:</span> {boardReview.focusRole}
                  </div>
                )}
              </div>
            )}

            <BoardVoices voices={boardReview.voices} />
            <BoardSynthesisPanel synthesis={boardReview.synthesis} />
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
```

Note: `CopyMarkdownButton`'s prop is `getMarkdown: () => string` and `label: string` — confirmed from the F11 implementation.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/board/page.tsx
git commit -m "feat(board): add /board orchestrator with input and review views"
```

---

## Task 9: ActionsZone — add "Board of advisors" to Reflect group

**Files:**
- Modify: `components/landing/ActionsZone.tsx`

- [ ] **Step 1: Add the handler and button**

Add `Users` to the lucide import at the top:

```ts
import { Compass, MessageCircle, SearchCheck, Route as RouteIcon, Mic, Sparkles, Users } from 'lucide-react';
```

Add the handler immediately after `handleOdyssey`:

```ts
  async function handleBoard() {
    clearMissingHints();
    if (!(await ensureProvider())) return;
    router.push('/board');
  }
```

In the Reflect `<section>` of the return block, change the grid contents from the single Odyssey button to both:

```tsx
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <Button onClick={handleOdyssey} disabled={anyRunning} variant='outline' className='py-6'>
            <Sparkles className='w-4 h-4 mr-2' />
            Imagine three lives
          </Button>
          <Button onClick={handleBoard} disabled={anyRunning} variant='outline' className='py-6'>
            <Users className='w-4 h-4 mr-2' />
            Board of advisors
          </Button>
        </div>
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/ActionsZone.tsx
git commit -m "feat(landing): add Board of advisors button to Reflect group"
```

---

## Task 10: OutputsBanner — board quick-jump link

**Files:**
- Modify: `components/landing/OutputsBanner.tsx`

- [ ] **Step 1: Add detection and link**

Add `boardReview` to the existing `store` destructure:

```ts
  const {
    chatMessages,
    careers,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
    odysseyLives,
    boardReview,
  } = store;
```

Add detection after `hasOdyssey`:

```ts
  const hasBoard = !!boardReview;
```

Add `!hasBoard` to the early-return guard condition.

Add the link inside the flex row, immediately after the Odyssey link:

```tsx
        {hasBoard && (
          <Link href='/board' className='underline hover:text-accent'>
            board review ready
          </Link>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/OutputsBanner.tsx
git commit -m "feat(landing): add board review quick-jump link to OutputsBanner"
```

---

## Task 11: ChatComposer — optional onBoard chain button

**Files:**
- Modify: `components/chat/ChatComposer.tsx`

- [ ] **Step 1: Read the existing component first**

Read `components/chat/ChatComposer.tsx` to confirm the current shape of `Props` and where the existing chain buttons (including `onOdyssey` added in F11) render.

- [ ] **Step 2: Add `onBoard` alongside `onOdyssey`**

Add to the `Props` type near `onOdyssey`:

```ts
  onBoard?: () => void;
  boardDisabled?: boolean;
```

Destructure the new props in the component signature alongside `onOdyssey`.

In the chain-button row where `onOdyssey` renders its button, add an adjacent button matching the same style:

```tsx
      {onBoard && (
        <button
          type='button'
          onClick={onBoard}
          disabled={boardDisabled}
          className='text-[var(--text-sm)] text-ink-muted hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed'
        >
          Try as board review →
        </button>
      )}
```

Match the exact styling and container element used by the existing `onOdyssey` chain button. If `onOdyssey`'s button uses a different element or className, copy its pattern.

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatComposer.tsx
git commit -m "feat(chat): add optional onBoard chain button to ChatComposer"
```

---

## Task 12: `app/chat/page.tsx` — handleBoard handler

**Files:**
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Read the existing handlers**

Read `app/chat/page.tsx` to find the F11 `handleOdyssey` function — it's the pattern to mirror. Note the local names for `distilling`, `setDistilling`, `store`, `router`, and `userMessageCount` (or equivalent). `StudentProfile` is already imported from `@/lib/session-store` after F11.

- [ ] **Step 2: Add `handleBoard`**

Add immediately after `handleOdyssey`:

```ts
  async function handleBoard() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    setDistilling(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/distillProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: useSessionStore.getState().chatMessages,
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          jobTitle: store.jobTitle || undefined,
          guidance:
            'Produce a one-to-two sentence framing summary describing what the student seems to be worried about or wanting feedback on in this conversation. This will be used as the opening question for a Board of Advisors profile review. Write it in first person from the student\'s perspective (for example "I\'m worried that..."). Put this in the "background" field.',
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not distil the chat');
      }
      const { profile } = (await res.json()) as { profile: StudentProfile };
      const framing = profile.background || '';
      store.setBoardPrefill({ framing });
      router.push('/board');
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Could not set up board review from this chat.'
      );
    } finally {
      setDistilling(false);
    }
  }
```

- [ ] **Step 3: Wire the prop into ChatComposer**

At the ChatComposer render site, add (adjacent to the existing `onOdyssey` props):

```tsx
        onBoard={handleBoard}
        boardDisabled={distilling || userMessageCount < 3}
```

Substitute the local names for `distilling` and `userMessageCount` if they differ.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat(chat): add Board chain handler reusing distillProfile with board guidance"
```

---

## Task 13: CareerNode — "Ask the board about this role" shortcut

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Read the file**

Read `components/CareerNode.tsx` to find:
- How existing shortcut buttons (e.g., "Chat about this", "Analyse gaps for this role", "Learning path for this role") render
- The name of the prop containing the career data (`data.jobTitle` or similar)
- How they navigate (likely `useRouter()` + `router.push(...)`)
- Whether `useSessionStore` is already imported

- [ ] **Step 2: Add the shortcut handler**

If `useSessionStore` is not already imported, add:

```ts
import { useSessionStore } from '@/lib/session-store';
```

Add a handler near the existing shortcut handlers:

```ts
  function handleBoardShortcut() {
    useSessionStore.getState().setBoardPrefill({ focusRole: data.jobTitle });
    router.push('/board');
  }
```

Substitute `data.jobTitle` with whatever the existing code uses to read the job title from the node data.

- [ ] **Step 3: Add the button to the shortcut row**

Add a button matching the pattern of the existing shortcut buttons (same variant, same className, same icon sizing). Use the `Users` icon from lucide-react (import it if not already imported):

```tsx
      <Button
        variant='outline'
        size='sm'
        onClick={handleBoardShortcut}
      >
        <Users className='w-3 h-3 mr-1' />
        Ask the board about this role
      </Button>
```

Match the existing shortcut button styling exactly — if they use different sizing, props, or layout wrapping, follow that instead.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/CareerNode.tsx
git commit -m "feat(careers): add Ask the board about this role shortcut"
```

---

## Task 14: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS — all prior tests plus new board tests.

- [ ] **Step 2: Start the app**

Run: `npm run electron:dev`

- [ ] **Step 3: Walk the manual QA checklist from the spec**

From `docs/superpowers/specs/2026-04-15-f12-board-of-advisors-design.md`, walk every item under "Manual QA checklist". Specifically:

- Landing Reflect group now shows two buttons (Imagine three lives, Board of advisors)
- Click Board of advisors → `/board` input view, both fields empty
- With no profile material → convene button disabled with helper text
- With resume uploaded → convene enabled → click → loading state → review view with 4 voices + synthesis
- Voices render in fixed order (Recruiter, HR, Manager, Mentor) regardless of LLM ordering
- Synthesis shows agreements, disagreements, priorities
- Framing populated → convene → review echoes framing at the top
- Focus role populated → convene → review echoes focus role at the top
- Copy as Markdown → includes framing, focus, four voices, synthesis, footer
- Empty framing + empty focus → Markdown shows "Open review — no specific focus" and "None"
- Run again → confirmation → returns to input view with previous framing + focus pre-filled
- Start over → full session cleared including boardReview
- Career card "Ask the board about this role" → `/board` with focus pre-filled
- Visit `/board` a second time → pre-fill does not re-apply
- Chat after 3+ user messages → "Try as board review →" enabled
- Click chain → distillation → `/board` with framing pre-filled
- OutputsBanner shows "board review ready" once a review exists
- Click OutputsBanner link → returns to `/board` review view
- No LLM provider configured → pre-flight redirect from landing button and convene button
- Reload Electron → state lost (expected)
- All existing 6 landing buttons still work and are in their correct groups
- Electron dev build end to end

- [ ] **Step 4: Fix any QA findings**

If any behaviour is wrong, commit fixes as separate commits. Do not mark the task complete until QA passes.

---

## Notes for the implementer

- **No grounding.** Do not wire search into the board route. This is voiced reflection.
- **Studio Calm tokens only.** `bg-paper`, `border-border`, `text-ink`, `text-ink-muted`, `text-ink-quiet`, `text-accent`, `bg-accent-soft`, `text-error`. No raw hex colours.
- **Em dashes:** the user's preference is to avoid em dashes in UI copy. Section headings and decorative rules are fine. Prose copy should use periods or commas. The prompt body can use em dashes freely — it's a system message.
- **Fixed advisor order.** The parser coerces to `['recruiter','hr','manager','mentor']`. The UI renders exactly that order. Don't let it drift.
- **One LLM call.** Do not refactor into four parallel calls. The single-call design is deliberate — voices reference each other better and Ollama latency stays manageable.
- **`boardPrefill` is read-and-clear.** Use `consumeBoardPrefill()` on mount, not `getState().boardPrefill`. Reading without clearing would re-apply the pre-fill on a second visit.
- **Trim-retry chain:** advert first, then resume, then honest 500. Mirrors gap analysis and odyssey.
- **Run again preserves inputs.** The handler writes `boardPrefill` with the previous framing and focus before clearing the review so the student returns to a pre-filled input view.
- **Career card shortcut** uses `useSessionStore.getState().setBoardPrefill(...)` directly rather than a React hook, because career nodes may not be rendered inside a Zustand-reactive scope. Pattern matches the existing career card shortcuts.
- **CopyMarkdownButton prop is `getMarkdown: () => string`** (confirmed in F11), not `text`. Don't change it back.
