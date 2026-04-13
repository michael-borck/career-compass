# F14 — Interview Role-Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship F14 — a structured practice-interview surface for Career Compass with 5-phase mock interviews, 3 difficulty levels, structured feedback (with example answer reframes), and Talk Buddy scenario export.

**Architecture:** New `/interview` route with three internal states (setup card → chat → feedback). Reuses Phase 1's chat components and Phase 2's helpers. Two new API routes (`/api/interview` per-turn, `/api/interviewFeedback` one-shot). Phase advancement is route-tracked, not model-tracked. Feedback rendering replaces the chat view in the same page so "Practice again" can reset cleanly.

**Tech Stack:** Next.js 14 App Router · TypeScript · Zustand · Vitest · existing Tailwind / Radix / react-hot-toast stack. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-04-13-f14-interview-roleplay-design.md`

---

## Notes for the implementer

- **Build on Phases 1 + 2.** Both are shipped and stable. Read the Phase 2 spec at `docs/superpowers/specs/2026-04-13-phase2-gap-analysis-learning-path-design.md` first if you need orientation on the unified inputs+actions landing, the OutputsBanner, the gap analysis / learning path output pages, or the shared `loadLLMConfig` / `isLLMConfigured` / `isTokenLimitError` / `CopyMarkdownButton` helpers.
- **TDD discipline.** Every pure function (prompt builders, parsers, phase helpers, markdown exporters, talk-buddy exporter): write the test, run to confirm it fails, implement, run to confirm pass, commit. UI components (.tsx) get manual QA only.
- **One commit per task.** Smaller is fine if a task naturally subdivides.
- **Frequent type-checks.** After every task that touches `.ts` or `.tsx`, run `npx tsc --noEmit`. Expected: clean. Pre-existing errors in unrelated files are OK only if they exist on `main` before the task starts.
- **All paths are absolute from the repo root** (`/Users/michael/Projects/career-compass/...`). Examples below omit the prefix.
- **Conventions to follow.** Studio Calm tokens (`bg-paper`, `border-border`, `text-ink`, `text-ink-muted`, `text-ink-quiet`, `bg-accent-soft`, `text-accent`, `text-error`, text sizes like `text-[var(--text-lg)]`). Lucide icons. `react-hot-toast` for transient messages. `useRouter` from `next/navigation`. Existing UI primitives in `components/ui/` (lowercase).
- **Don't reformat unrelated files.** Touch only what each task lists.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/context-block.ts` | Extracted from `app/api/chat/route.ts`. `buildContextBlock(resumeText, freeText, jobTitle, jobAdvert, distilledProfile?)` — shared between chat and interview routes. |
| `lib/context-block.test.ts` | Unit tests for the extracted helper. |
| `lib/interview-phases.ts` | `PHASE_ORDER`, `PHASE_CONFIG`, `nextPhase()` advancement helper. |
| `lib/interview-phases.test.ts` | Unit tests. |
| `lib/prompts/interview.ts` | `buildInterviewSystemPrompt` per-turn prompt with phase + difficulty + turn awareness. |
| `lib/prompts/interview.test.ts` | Unit tests. |
| `lib/prompts/interview-feedback.ts` | `buildFeedbackPrompt` + `parseFeedback`. |
| `lib/prompts/interview-feedback.test.ts` | Unit tests. |
| `lib/talk-buddy-export.ts` | `buildTalkBuddyScenario(target, difficulty)` returning `{ filename, json }`. |
| `lib/talk-buddy-export.test.ts` | Unit tests. |
| `lib/download.ts` | `downloadJsonFile(filename, json)` browser helper. |
| `app/api/interview/route.ts` | POST per-turn interviewer endpoint. |
| `app/api/interviewFeedback/route.ts` | POST one-shot feedback endpoint. |
| `app/interview/page.tsx` | Orchestrator. Reads store, renders setup card / chat / feedback. |
| `components/interview/InterviewSetupCard.tsx` | Pre-start form. |
| `components/interview/InterviewChat.tsx` | Chat surface with interview-specific top bar. |
| `components/interview/InterviewPhaseProgress.tsx` | Five small dots showing phase progress. |
| `components/interview/InterviewFeedbackView.tsx` | Feedback panel. |
| `components/interview/InterviewImprovementItem.tsx` | Collapsible improvement row. |

### Modified files

| Path | Change |
|---|---|
| `lib/session-store.ts` | Add `InterviewDifficulty`, `InterviewPhase`, `InterviewImprovement`, `InterviewFeedback` types. Add `interviewMessages`, `interviewTarget`, `interviewDifficulty`, `interviewPhase`, `interviewTurnInPhase`, `interviewFeedback` fields. Add `setInterviewSession`, `addInterviewMessage`, `advanceInterviewPhase`, `setInterviewDifficulty`, `setInterviewTarget`, `setInterviewFeedback`, `resetInterview` actions. `reset()` clears all interview fields. |
| `lib/session-store.test.ts` | Extend tests to cover new fields, actions, and reset. |
| `lib/markdown-export.ts` | Add `interviewFeedbackToMarkdown(f)`. |
| `lib/markdown-export.test.ts` | Add tests for `interviewFeedbackToMarkdown`. |
| `app/api/chat/route.ts` | Replace inline `buildContextBlock` with import from `lib/context-block.ts`. No behaviour change. |
| `components/chat/ChatComposer.tsx` | Make `onPaperclip` prop optional. Hide paperclip button when undefined. |
| `components/CareerNode.tsx` | Add 4th button "Practice interview for this role" in the dialog footer. |
| `components/results/GapAnalysisView.tsx` | Add "Practice interview for this target →" chain button. |
| `components/results/LearningPathView.tsx` | Add "Practice interview for this target →" chain button. |
| `components/landing/ActionsZone.tsx` | Add 5th action "Practice interview" with inline missing-input prompting. |
| `components/landing/OutputsBanner.tsx` | Add "interview in progress" and "interview feedback ready" labels. |

---

## Task 1: Session store extension

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Add Phase 3 interview types**

In `lib/session-store.ts`, add ABOVE the existing `Gap` / `GapAnalysis` types (or wherever the Phase 2 types live):

```ts
export type InterviewDifficulty = 'friendly' | 'standard' | 'tough';

export type InterviewPhase =
  | 'warm-up'
  | 'behavioural'
  | 'role-specific'
  | 'your-questions'
  | 'wrap-up';

export type InterviewImprovement = {
  area: string;
  why: string;
  example: string;
};

export type InterviewFeedback = {
  target: string;
  difficulty: InterviewDifficulty;
  summary: string;
  strengths: string[];
  improvements: InterviewImprovement[];
  perPhase: { phase: InterviewPhase; note: string }[];
  overallRating: 'developing' | 'on-track' | 'strong';
  nextSteps: string[];
};
```

- [ ] **Step 2: Add fields to SessionState**

In the `SessionState` type, after the Phase 2 outputs (`gapAnalysis`, `learningPath`), add:

```ts
  // Interview
  interviewMessages: ChatMessage[];
  interviewTarget: string | null;
  interviewDifficulty: InterviewDifficulty;
  interviewPhase: InterviewPhase | null;
  interviewTurnInPhase: number;
  interviewFeedback: InterviewFeedback | null;
```

In the actions block of `SessionState`, after the Phase 2 setters, add:

```ts
  setInterviewSession: (target: string, difficulty: InterviewDifficulty) => void;
  addInterviewMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'kind'> & Partial<Pick<ChatMessage, 'id' | 'timestamp' | 'kind'>>) => void;
  advanceInterviewPhase: (phase: InterviewPhase | null, turnInPhase: number) => void;
  setInterviewDifficulty: (d: InterviewDifficulty) => void;
  setInterviewTarget: (t: string | null) => void;
  setInterviewFeedback: (f: InterviewFeedback | null) => void;
  resetInterview: () => void;
```

- [ ] **Step 3: Update initial state and store implementation**

In the `initialState` constant near the bottom of `lib/session-store.ts`, add the new defaults:

```ts
  interviewMessages: [],
  interviewTarget: null,
  interviewDifficulty: 'standard',
  interviewPhase: null,
  interviewTurnInPhase: 0,
  interviewFeedback: null,
```

In the `create<SessionState>(...)` body, after the Phase 2 actions, add:

```ts
  setInterviewSession: (target, difficulty) =>
    set({
      interviewTarget: target,
      interviewDifficulty: difficulty,
      interviewMessages: [],
      interviewPhase: 'warm-up',
      interviewTurnInPhase: 0,
      interviewFeedback: null,
    }),

  addInterviewMessage: (msg) =>
    set((s) => ({
      interviewMessages: [
        ...s.interviewMessages,
        {
          id: msg.id ?? makeId(),
          timestamp: msg.timestamp ?? Date.now(),
          kind: msg.kind ?? 'message',
          role: msg.role,
          content: msg.content,
        },
      ],
    })),

  advanceInterviewPhase: (phase, turnInPhase) =>
    set({ interviewPhase: phase, interviewTurnInPhase: turnInPhase }),

  setInterviewDifficulty: (d) => set({ interviewDifficulty: d }),
  setInterviewTarget: (t) => set({ interviewTarget: t }),
  setInterviewFeedback: (f) => set({ interviewFeedback: f }),

  resetInterview: () =>
    set({
      interviewMessages: [],
      interviewTarget: null,
      interviewDifficulty: 'standard',
      interviewPhase: null,
      interviewTurnInPhase: 0,
      interviewFeedback: null,
    }),
```

The existing `reset()` action calls `set({ ...initialState })` which will automatically pick up the new fields from `initialState`. No change needed to `reset()` itself.

- [ ] **Step 4: Update existing initial-state test**

Open `lib/session-store.test.ts`. Find the `it('has empty initial state', ...)` test and add assertions for the new fields:

```ts
    expect(s.interviewMessages).toEqual([]);
    expect(s.interviewTarget).toBeNull();
    expect(s.interviewDifficulty).toBe('standard');
    expect(s.interviewPhase).toBeNull();
    expect(s.interviewTurnInPhase).toBe(0);
    expect(s.interviewFeedback).toBeNull();
```

- [ ] **Step 5: Add tests for the new actions**

Append to the `describe('session store actions', ...)` block:

```ts
  it('setInterviewSession primes a fresh interview', () => {
    const s = useSessionStore.getState();
    s.addInterviewMessage({ role: 'user', content: 'old message' });
    s.setInterviewSession('Data Analyst', 'tough');
    const after = useSessionStore.getState();
    expect(after.interviewTarget).toBe('Data Analyst');
    expect(after.interviewDifficulty).toBe('tough');
    expect(after.interviewMessages).toEqual([]);
    expect(after.interviewPhase).toBe('warm-up');
    expect(after.interviewTurnInPhase).toBe(0);
    expect(after.interviewFeedback).toBeNull();
  });

  it('addInterviewMessage appends with auto id/timestamp/kind', () => {
    useSessionStore.getState().addInterviewMessage({
      role: 'assistant',
      content: 'first question',
    });
    const msgs = useSessionStore.getState().interviewMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[0].content).toBe('first question');
    expect(msgs[0].id).toBeTruthy();
    expect(msgs[0].kind).toBe('message');
    expect(typeof msgs[0].timestamp).toBe('number');
  });

  it('advanceInterviewPhase updates phase and turn counter', () => {
    useSessionStore.getState().advanceInterviewPhase('behavioural', 0);
    const s = useSessionStore.getState();
    expect(s.interviewPhase).toBe('behavioural');
    expect(s.interviewTurnInPhase).toBe(0);
  });

  it('setInterviewFeedback writes the field', () => {
    const fb = {
      target: 'Data Analyst',
      difficulty: 'standard' as const,
      summary: 's',
      strengths: ['a'],
      improvements: [{ area: 'x', why: 'y', example: 'z' }],
      perPhase: [],
      overallRating: 'on-track' as const,
      nextSteps: ['n'],
    };
    useSessionStore.getState().setInterviewFeedback(fb);
    expect(useSessionStore.getState().interviewFeedback).toEqual(fb);
  });

  it('resetInterview clears interview state but not other state', () => {
    const s = useSessionStore.getState();
    s.setResume('a', 'b');
    s.setInterviewSession('X', 'tough');
    s.addInterviewMessage({ role: 'user', content: 'c' });
    s.resetInterview();
    const after = useSessionStore.getState();
    expect(after.resumeText).toBe('a'); // preserved
    expect(after.interviewTarget).toBeNull();
    expect(after.interviewMessages).toEqual([]);
    expect(after.interviewDifficulty).toBe('standard');
    expect(after.interviewPhase).toBeNull();
  });
```

Find the existing `it('reset clears everything', ...)` test and add interview assertions to the setup block AND the after-reset block:

In the setup section (before `s.reset()`), add:
```ts
    s.setInterviewSession('Z', 'friendly');
    s.addInterviewMessage({ role: 'user', content: 'm' });
    s.setInterviewFeedback({
      target: 'Z', difficulty: 'friendly',
      summary: 's', strengths: [], improvements: [],
      perPhase: [], overallRating: 'developing', nextSteps: [],
    });
```

In the after-reset assertions, add:
```ts
    expect(after.interviewMessages).toEqual([]);
    expect(after.interviewTarget).toBeNull();
    expect(after.interviewDifficulty).toBe('standard');
    expect(after.interviewPhase).toBeNull();
    expect(after.interviewTurnInPhase).toBe(0);
    expect(after.interviewFeedback).toBeNull();
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- lib/session-store.test.ts`
Expected: PASS — all existing tests plus the 5 new ones.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "Add F14 interview types, fields, and actions to session store"
```

---

## Task 2: Extract buildContextBlock into shared helper (TDD)

**Files:**
- Create: `lib/context-block.ts`
- Create: `lib/context-block.test.ts`
- Modify: `app/api/chat/route.ts`

The chat route at `app/api/chat/route.ts` currently has an inline `buildContextBlock` function. The interview route needs the same logic plus optional `distilledProfile` support. Extracting it now also lets us add tests it currently lacks.

- [ ] **Step 1: Write the failing tests**

Create `lib/context-block.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildContextBlock } from './context-block';

describe('buildContextBlock', () => {
  it('returns null when all inputs are empty', () => {
    expect(buildContextBlock()).toBeNull();
    expect(buildContextBlock(null, '', '', '')).toBeNull();
    expect(buildContextBlock('   ', '   ', '   ', '   ')).toBeNull();
  });

  it('includes resume when provided', () => {
    const out = buildContextBlock('my resume text');
    expect(out).toContain('RESUME');
    expect(out).toContain('my resume text');
  });

  it('includes free text when provided', () => {
    const out = buildContextBlock(null, 'about me');
    expect(out).toContain('BACKGROUND');
    expect(out).toContain('about me');
  });

  it('includes job title when provided', () => {
    const out = buildContextBlock(null, '', 'Data Analyst');
    expect(out).toContain('JOB OF INTEREST');
    expect(out).toContain('Data Analyst');
  });

  it('includes job advert when provided', () => {
    const out = buildContextBlock(null, '', '', 'We are hiring...');
    expect(out).toContain('JOB ADVERT');
    expect(out).toContain('We are hiring');
  });

  it('includes a distilled profile when provided', () => {
    const out = buildContextBlock(null, '', '', '', {
      background: 'CS student',
      interests: ['data'],
      skills: ['python'],
      constraints: [],
      goals: ['data role'],
    });
    expect(out).toContain('CS student');
    expect(out).toContain('python');
    expect(out).toContain('data role');
  });

  it('combines multiple inputs', () => {
    const out = buildContextBlock('R', 'F', 'T', 'A');
    expect(out).toContain('R');
    expect(out).toContain('F');
    expect(out).toContain('T');
    expect(out).toContain('A');
  });

  it('returns the disambiguation hint phrase', () => {
    const out = buildContextBlock('r');
    expect(out).toContain('you CAN read it');
    expect(out).toContain('the resume');
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm run test -- lib/context-block.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/context-block.ts`**

```ts
import type { StudentProfile } from './session-store';

function formatProfile(p: StudentProfile): string {
  const parts: string[] = [];
  if (p.background) parts.push(`Background: ${p.background}`);
  if (p.interests.length > 0) parts.push(`Interests: ${p.interests.join(', ')}`);
  if (p.skills.length > 0) parts.push(`Skills: ${p.skills.join(', ')}`);
  if (p.constraints.length > 0) parts.push(`Constraints: ${p.constraints.join(', ')}`);
  if (p.goals.length > 0) parts.push(`Goals: ${p.goals.join(', ')}`);
  return parts.join('\n');
}

export function buildContextBlock(
  resumeText?: string | null,
  freeText?: string,
  jobTitle?: string,
  jobAdvert?: string,
  distilledProfile?: StudentProfile | null
): string | null {
  const parts: string[] = [];
  if (resumeText && resumeText.trim()) {
    parts.push(`RESUME (full text, shared directly with you):\n${resumeText.trim()}`);
  }
  if (freeText && freeText.trim()) {
    parts.push(`BACKGROUND NOTES (shared directly with you):\n${freeText.trim()}`);
  }
  if (jobTitle && jobTitle.trim()) {
    parts.push(`JOB OF INTEREST: ${jobTitle.trim()}`);
  }
  if (jobAdvert && jobAdvert.trim()) {
    parts.push(`JOB ADVERT (full text, shared directly with you):\n${jobAdvert.trim()}`);
  }
  if (distilledProfile) {
    const profileText = formatProfile(distilledProfile);
    if (profileText) {
      parts.push(`STUDENT PROFILE (distilled from a previous chat):\n${profileText}`);
    }
  }
  if (parts.length === 0) return null;
  return `The student has shared the following information with you. The full text is included below — you CAN read it. When the student refers to "my resume", "the resume", "my attachment", "the job", "the advert", "what I uploaded", or similar phrases, they mean this content. Refer to it by its details, not as a separate file:\n\n${parts.join('\n\n')}`;
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm run test -- lib/context-block.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Update `app/api/chat/route.ts` to import the helper**

Read the file first. Add at the top with the other lib imports:

```ts
import { buildContextBlock } from '@/lib/context-block';
```

Delete the inline `function buildContextBlock(...)` definition entirely. Delete the `formatProfile` helper too if it exists inline (the new version owns it). Keep all other route logic identical.

If the existing `buildContextBlock` call site doesn't pass a 5th `distilledProfile` argument, leave it as-is — the new helper has it as an optional parameter, so existing 4-arg calls still work.

- [ ] **Step 6: Type-check + tests**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run test`
Expected: all PASS, including the new 8 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/context-block.ts lib/context-block.test.ts app/api/chat/route.ts
git commit -m "Extract buildContextBlock into shared helper with tests

Used by both the chat route and the upcoming interview route.
Adds optional distilledProfile parameter and unit tests the
inline version never had."
```

---

## Task 3: interview-phases module (TDD)

**Files:**
- Create: `lib/interview-phases.ts`
- Create: `lib/interview-phases.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/interview-phases.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PHASE_ORDER, PHASE_CONFIG, nextPhase } from './interview-phases';

describe('PHASE_ORDER', () => {
  it('is the expected 5 phases in order', () => {
    expect(PHASE_ORDER).toEqual([
      'warm-up',
      'behavioural',
      'role-specific',
      'your-questions',
      'wrap-up',
    ]);
  });
});

describe('PHASE_CONFIG turn counts', () => {
  it('warm-up has 1 turn', () => {
    expect(PHASE_CONFIG['warm-up'].turnsPerPhase).toBe(1);
  });
  it('behavioural has 2 turns', () => {
    expect(PHASE_CONFIG.behavioural.turnsPerPhase).toBe(2);
  });
  it('role-specific has 2 turns', () => {
    expect(PHASE_CONFIG['role-specific'].turnsPerPhase).toBe(2);
  });
  it('your-questions has 1 turn', () => {
    expect(PHASE_CONFIG['your-questions'].turnsPerPhase).toBe(1);
  });
  it('wrap-up has 1 turn', () => {
    expect(PHASE_CONFIG['wrap-up'].turnsPerPhase).toBe(1);
  });
  it('totals 7 interviewer turns', () => {
    const total = PHASE_ORDER.reduce(
      (n, p) => n + PHASE_CONFIG[p].turnsPerPhase,
      0
    );
    expect(total).toBe(7);
  });
});

describe('nextPhase', () => {
  it('warm-up turn 0 → behavioural turn 0 (warm-up has 1 turn)', () => {
    const r = nextPhase('warm-up', 0);
    expect(r).toEqual({ phase: 'behavioural', turnInPhase: 0, isComplete: false });
  });

  it('behavioural turn 0 → behavioural turn 1 (still in phase)', () => {
    const r = nextPhase('behavioural', 0);
    expect(r).toEqual({ phase: 'behavioural', turnInPhase: 1, isComplete: false });
  });

  it('behavioural turn 1 → role-specific turn 0', () => {
    const r = nextPhase('behavioural', 1);
    expect(r).toEqual({ phase: 'role-specific', turnInPhase: 0, isComplete: false });
  });

  it('role-specific turn 0 → role-specific turn 1', () => {
    const r = nextPhase('role-specific', 0);
    expect(r).toEqual({ phase: 'role-specific', turnInPhase: 1, isComplete: false });
  });

  it('role-specific turn 1 → your-questions turn 0', () => {
    const r = nextPhase('role-specific', 1);
    expect(r).toEqual({ phase: 'your-questions', turnInPhase: 0, isComplete: false });
  });

  it('your-questions turn 0 → wrap-up turn 0', () => {
    const r = nextPhase('your-questions', 0);
    expect(r).toEqual({ phase: 'wrap-up', turnInPhase: 0, isComplete: false });
  });

  it('wrap-up turn 0 → null with isComplete', () => {
    const r = nextPhase('wrap-up', 0);
    expect(r).toEqual({ phase: null, turnInPhase: 0, isComplete: true });
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm run test -- lib/interview-phases.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/interview-phases.ts`**

```ts
import type { InterviewPhase } from './session-store';

export type PhaseConfig = {
  phase: InterviewPhase;
  turnsPerPhase: number;
  description: string;
  guidance: string;
};

export const PHASE_ORDER: InterviewPhase[] = [
  'warm-up',
  'behavioural',
  'role-specific',
  'your-questions',
  'wrap-up',
];

export const PHASE_CONFIG: Record<InterviewPhase, PhaseConfig> = {
  'warm-up': {
    phase: 'warm-up',
    turnsPerPhase: 1,
    description: 'Warm-up — one easy intro question to get the student talking.',
    guidance: 'Ask one simple opener like "Tell me about yourself" or "Walk me through your background." Be friendly. Do not probe yet.',
  },
  'behavioural': {
    phase: 'behavioural',
    turnsPerPhase: 2,
    description: 'Behavioural — STAR-method situational questions.',
    guidance: 'Ask "Tell me about a time when..." style questions. Target soft skills relevant to the role: teamwork, problem-solving, communication, dealing with ambiguity. Two questions total in this phase.',
  },
  'role-specific': {
    phase: 'role-specific',
    turnsPerPhase: 2,
    description: 'Role-specific — questions tied to the actual job.',
    guidance: 'Ask questions specific to the target role. For technical roles, ask about a relevant skill or scenario. For non-technical roles, ask about domain knowledge or methodology. Two questions total in this phase.',
  },
  'your-questions': {
    phase: 'your-questions',
    turnsPerPhase: 1,
    description: 'Your questions — invite the student to ask back.',
    guidance: 'Say something like "We have a few minutes left. What questions do you have for me about the role or the team?" Then respond naturally to whatever they ask. One turn total.',
  },
  'wrap-up': {
    phase: 'wrap-up',
    turnsPerPhase: 1,
    description: 'Wrap-up — polite close.',
    guidance: 'Thank the student for their time. Tell them this concludes the practice interview and that they can click "End interview" to see their feedback. Do not ask another question.',
  },
};

export function nextPhase(
  current: InterviewPhase,
  turnInPhase: number
): { phase: InterviewPhase | null; turnInPhase: number; isComplete: boolean } {
  const config = PHASE_CONFIG[current];
  if (turnInPhase + 1 >= config.turnsPerPhase) {
    const idx = PHASE_ORDER.indexOf(current);
    if (idx + 1 >= PHASE_ORDER.length) {
      return { phase: null, turnInPhase: 0, isComplete: true };
    }
    return { phase: PHASE_ORDER[idx + 1], turnInPhase: 0, isComplete: false };
  }
  return { phase: current, turnInPhase: turnInPhase + 1, isComplete: false };
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm run test -- lib/interview-phases.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/interview-phases.ts lib/interview-phases.test.ts
git commit -m "Add interview phase config and nextPhase advancement helper"
```

---

## Task 4: Interviewer prompt builder (TDD)

**Files:**
- Create: `lib/prompts/interview.ts`
- Create: `lib/prompts/interview.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/prompts/interview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildInterviewSystemPrompt } from './interview';

describe('buildInterviewSystemPrompt', () => {
  it('includes the target role name', () => {
    const out = buildInterviewSystemPrompt({
      target: 'Data Analyst',
      difficulty: 'standard',
      phase: 'warm-up',
      turnInPhase: 0,
    });
    expect(out).toContain('Data Analyst');
  });

  it('includes the difficulty label', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'tough',
      phase: 'warm-up',
      turnInPhase: 0,
    });
    expect(out).toContain('DIFFICULTY: tough');
  });

  it('different difficulties produce different tone instructions', () => {
    const friendly = buildInterviewSystemPrompt({
      target: 'X', difficulty: 'friendly', phase: 'warm-up', turnInPhase: 0,
    });
    const tough = buildInterviewSystemPrompt({
      target: 'X', difficulty: 'tough', phase: 'warm-up', turnInPhase: 0,
    });
    expect(friendly).toContain('encouraging');
    expect(tough).toContain('pointed');
    expect(friendly).not.toBe(tough);
  });

  it('includes the current phase description', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'behavioural',
      turnInPhase: 0,
    });
    expect(out).toContain('Behavioural');
    expect(out).toContain('STAR');
  });

  it('includes the turn counter in 1-indexed form', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'behavioural',
      turnInPhase: 1,
    });
    expect(out).toContain('Turn 2 of 2');
  });

  it('first turn shows as Turn 1 of N', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'behavioural',
      turnInPhase: 0,
    });
    expect(out).toContain('Turn 1 of 2');
  });

  it('includes the global rules', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X', difficulty: 'standard', phase: 'warm-up', turnInPhase: 0,
    });
    expect(out).toContain('exactly ONE question');
    expect(out).toContain('Do not break character');
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm run test -- lib/prompts/interview.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/prompts/interview.ts`**

```ts
import type { InterviewDifficulty, InterviewPhase } from '@/lib/session-store';
import { PHASE_CONFIG } from '@/lib/interview-phases';

export type InterviewPromptInput = {
  target: string;
  difficulty: InterviewDifficulty;
  phase: InterviewPhase;
  turnInPhase: number;
};

const DIFFICULTY_TONE: Record<InterviewDifficulty, string> = {
  friendly: 'Be encouraging and warm. Use gentle follow-ups. Treat this as a coaching conversation. If the student gives a weak answer, ask a follow-up that helps them improve, not one that exposes the weakness.',
  standard: 'Be neutral and professional, like a real first-round phone screen. Expect clear answers. If an answer is vague, probe briefly with one follow-up. Move on if the answer is good enough.',
  tough: 'Be pointed and direct, like a second-round panel interview. Expect specific answers grounded in the student\'s actual experience. If an answer is vague or generic, push back: "That\'s a general answer — what specifically did YOU do?" Do not be hostile, but do not let weak answers slide.',
};

export function buildInterviewSystemPrompt(input: InterviewPromptInput): string {
  const { target, difficulty, phase, turnInPhase } = input;
  const config = PHASE_CONFIG[phase];

  return `You are conducting a practice job interview for the role of ${target}. The student is using this to prepare for real interviews.

DIFFICULTY: ${difficulty}
${DIFFICULTY_TONE[difficulty]}

CURRENT PHASE: ${config.description}
PHASE GUIDANCE: ${config.guidance}
Turn ${turnInPhase + 1} of ${config.turnsPerPhase}

GLOBAL RULES:
- Ask exactly ONE question per message. Wait for the student's answer before continuing.
- Do not give feedback during the interview. Stay in character as an interviewer.
- Use the student's resume / background / job advert (provided as context) to ask informed questions. Reference specific things from their background by name.
- Do not break character. Do not say "as an AI" or "in this practice session." You are an interviewer.
- Keep messages short — 2-4 sentences max. Real interviewers don't monologue.
- If the student goes off-topic, politely steer back to the interview.

The full system prompt is followed by additional context the student has shared (resume, background notes, job of interest). Use that context to make your questions feel grounded and personal.`;
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm run test -- lib/prompts/interview.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/interview.ts lib/prompts/interview.test.ts
git commit -m "Add interviewer system prompt builder"
```

---

## Task 5: Feedback prompt builder + parser (TDD)

**Files:**
- Create: `lib/prompts/interview-feedback.ts`
- Create: `lib/prompts/interview-feedback.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/prompts/interview-feedback.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFeedbackPrompt, parseFeedback } from './interview-feedback';
import type { ChatMessage, InterviewFeedback } from '@/lib/session-store';

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: Math.random().toString(),
    role,
    content,
    timestamp: Date.now(),
    kind: 'message',
  };
}

describe('buildFeedbackPrompt', () => {
  it('includes the target and difficulty', () => {
    const out = buildFeedbackPrompt({
      target: 'Data Analyst',
      difficulty: 'standard',
      messages: [msg('user', 'I have SQL skills')],
      reachedPhase: 'wrap-up',
    });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('standard');
  });

  it('includes the transcript', () => {
    const out = buildFeedbackPrompt({
      target: 'X',
      difficulty: 'standard',
      messages: [
        msg('assistant', 'Tell me about yourself'),
        msg('user', 'I am a CS student'),
      ],
      reachedPhase: 'wrap-up',
    });
    expect(out).toContain('Tell me about yourself');
    expect(out).toContain('I am a CS student');
  });

  it('mentions partial-interview when reachedPhase is not wrap-up', () => {
    const out = buildFeedbackPrompt({
      target: 'X',
      difficulty: 'standard',
      messages: [msg('user', 'x')],
      reachedPhase: 'behavioural',
    });
    expect(out).toMatch(/early|partial|incomplete/i);
  });

  it('does not mention partial when reachedPhase is wrap-up', () => {
    const out = buildFeedbackPrompt({
      target: 'X',
      difficulty: 'standard',
      messages: [msg('user', 'x')],
      reachedPhase: 'wrap-up',
    });
    expect(out).not.toMatch(/ended early/i);
  });

  it('asks for the InterviewFeedback JSON shape', () => {
    const out = buildFeedbackPrompt({
      target: 'X', difficulty: 'standard', messages: [msg('user', 'x')], reachedPhase: 'wrap-up',
    });
    expect(out).toContain('summary');
    expect(out).toContain('strengths');
    expect(out).toContain('improvements');
    expect(out).toContain('perPhase');
    expect(out).toContain('overallRating');
    expect(out).toContain('nextSteps');
    expect(out).toContain('example');
  });
});

describe('parseFeedback', () => {
  const validRaw = JSON.stringify({
    target: 'Data Analyst',
    difficulty: 'standard',
    summary: 'Solid effort with clear room to grow.',
    strengths: ['Clear intro', 'Good examples'],
    improvements: [
      {
        area: 'Use STAR structure',
        why: 'Behavioural questions need situation/action/result.',
        example: 'Instead of "I worked on a team", say "When NPS dropped 15 points..."',
      },
    ],
    perPhase: [{ phase: 'warm-up', note: 'Confident' }],
    overallRating: 'on-track',
    nextSteps: ['Practice 3 STAR answers', 'Brush up on SQL'],
  });

  it('parses a clean JSON response', () => {
    const f = parseFeedback(validRaw);
    expect(f.target).toBe('Data Analyst');
    expect(f.improvements).toHaveLength(1);
    expect(f.improvements[0].area).toBe('Use STAR structure');
    expect(f.overallRating).toBe('on-track');
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + validRaw + '\n```';
    const f = parseFeedback(wrapped);
    expect(f.target).toBe('Data Analyst');
  });

  it('coerces missing perPhase to empty array', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      summary: 'y', strengths: [], improvements: [{
        area: 'a', why: 'b', example: 'c',
      }],
      overallRating: 'on-track', nextSteps: [],
    });
    const f = parseFeedback(raw);
    expect(f.perPhase).toEqual([]);
  });

  it('coerces invalid overallRating to on-track', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      summary: 'y', strengths: [], improvements: [{
        area: 'a', why: 'b', example: 'c',
      }],
      overallRating: 'not-a-rating', nextSteps: [],
    });
    const f = parseFeedback(raw);
    expect(f.overallRating).toBe('on-track');
  });

  it('throws when summary is missing', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      strengths: [], improvements: [{ area: 'a', why: 'b', example: 'c' }],
      overallRating: 'on-track', nextSteps: [],
    });
    expect(() => parseFeedback(raw)).toThrow();
  });

  it('throws when improvements is empty', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      summary: 'y', strengths: [], improvements: [],
      overallRating: 'on-track', nextSteps: [],
    });
    expect(() => parseFeedback(raw)).toThrow();
  });

  it('preserves area, why, and example on each improvement', () => {
    const f = parseFeedback(validRaw);
    expect(f.improvements[0].area).toBeTruthy();
    expect(f.improvements[0].why).toBeTruthy();
    expect(f.improvements[0].example).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm run test -- lib/prompts/interview-feedback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/prompts/interview-feedback.ts`**

```ts
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewFeedback,
  InterviewImprovement,
  InterviewPhase,
} from '@/lib/session-store';

export type FeedbackPromptInput = {
  target: string;
  difficulty: InterviewDifficulty;
  messages: ChatMessage[];
  reachedPhase: InterviewPhase | null;
};

function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.kind === 'message')
    .map((m) => {
      const speaker = m.role === 'assistant' ? 'INTERVIEWER' : 'STUDENT';
      return `${speaker}: ${m.content}`;
    })
    .join('\n\n');
}

export function buildFeedbackPrompt(input: FeedbackPromptInput): string {
  const { target, difficulty, messages, reachedPhase } = input;
  const partialNote =
    reachedPhase !== 'wrap-up'
      ? `NOTE: This interview ended early. The student did not reach the wrap-up phase. Acknowledge this in the summary and only give per-phase notes for phases the student actually reached.\n\n`
      : '';

  return `You are giving feedback on a practice job interview. Be honest but encouraging. The student is using this to improve, not to be graded.

TARGET ROLE: ${target}
DIFFICULTY: ${difficulty}

${partialNote}Read the transcript below and respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "target": string — the role name (echo the target above),
  "difficulty": string — one of "friendly" / "standard" / "tough" (echo above),
  "summary": string — 2-3 sentence honest overview,
  "strengths": string[] — 3-5 things the student did well,
  "improvements": Improvement[] — 3-5 actionable improvements, ordered by priority,
  "perPhase": PerPhase[] — one entry per phase the student reached,
  "overallRating": "developing" | "on-track" | "strong",
  "nextSteps": string[] — 2-3 things to practice next, ordered by priority
}

Each Improvement has the shape:
{
  "area": string — what to work on,
  "why": string — 1 sentence explaining why this matters,
  "example": string — REWRITE one of the student's actual answers using this technique. The example is the most valuable field — never skip it. Quote or paraphrase what the student said, then show the improved version.
}

Each PerPhase has the shape:
{
  "phase": "warm-up" | "behavioural" | "role-specific" | "your-questions" | "wrap-up",
  "note": string — 1-2 sentences specific to this phase
}

RULES:
- Reference SPECIFIC moments from the transcript when giving feedback. Quote or paraphrase actual things the student said.
- For each improvement, the "example" field MUST rewrite an actual answer from the transcript using your suggested technique. Do not skip this field.
- "overallRating" must be exactly one of: "developing" / "on-track" / "strong". Use "developing" only if the student showed fundamental gaps. Use "on-track" for solid work with clear room to grow. Use "strong" only when the student is genuinely interview-ready for this difficulty level.
- "nextSteps" should be 2-3 items maximum, ordered by priority. Pick things the student can do this week.
- Never fabricate things the student didn't say. If you don't have enough information to evaluate a phase, say so honestly in the perPhase note.

<transcript>
${formatTranscript(messages)}
</transcript>

ONLY respond with JSON. No prose, no code fences.`;
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

const VALID_RATINGS = new Set(['developing', 'on-track', 'strong']);
const VALID_PHASES = new Set(['warm-up', 'behavioural', 'role-specific', 'your-questions', 'wrap-up']);

export function parseFeedback(raw: string): InterviewFeedback {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseFeedback: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseFeedback: missing summary');
  }
  if (!Array.isArray(parsed.improvements) || parsed.improvements.length === 0) {
    throw new Error('parseFeedback: improvements must be a non-empty array');
  }

  const improvements: InterviewImprovement[] = parsed.improvements.map(
    (i: any, idx: number) => {
      if (typeof i.area !== 'string' || !i.area.trim()) {
        throw new Error(`parseFeedback: improvement ${idx} missing area`);
      }
      return {
        area: i.area,
        why: typeof i.why === 'string' ? i.why : '',
        example: typeof i.example === 'string' ? i.example : '',
      };
    }
  );

  const perPhase = Array.isArray(parsed.perPhase)
    ? parsed.perPhase
        .filter((p: any) => p && VALID_PHASES.has(p.phase))
        .map((p: any) => ({
          phase: p.phase as InterviewPhase,
          note: typeof p.note === 'string' ? p.note : '',
        }))
    : [];

  const rating = VALID_RATINGS.has(parsed.overallRating)
    ? (parsed.overallRating as 'developing' | 'on-track' | 'strong')
    : 'on-track';

  const difficulty: InterviewDifficulty =
    parsed.difficulty === 'friendly' || parsed.difficulty === 'tough'
      ? parsed.difficulty
      : 'standard';

  return {
    target: typeof parsed.target === 'string' && parsed.target.trim() ? parsed.target : 'this role',
    difficulty,
    summary: parsed.summary,
    strengths: toStringArray(parsed.strengths),
    improvements,
    perPhase,
    overallRating: rating,
    nextSteps: toStringArray(parsed.nextSteps),
  };
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm run test -- lib/prompts/interview-feedback.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/interview-feedback.ts lib/prompts/interview-feedback.test.ts
git commit -m "Add interview feedback prompt builder and parser"
```

---

## Task 6: Talk Buddy export helper (TDD)

**Files:**
- Create: `lib/talk-buddy-export.ts`
- Create: `lib/talk-buddy-export.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/talk-buddy-export.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTalkBuddyScenario } from './talk-buddy-export';

describe('buildTalkBuddyScenario', () => {
  it('returns a filename and json string', () => {
    const out = buildTalkBuddyScenario('Data Analyst', 'standard');
    expect(typeof out.filename).toBe('string');
    expect(typeof out.json).toBe('string');
  });

  it('filename is slugified', () => {
    const out = buildTalkBuddyScenario('Senior Data Analyst (UK)', 'standard');
    expect(out.filename).toBe('mock-interview-senior-data-analyst-uk.json');
  });

  it('json parses back to a valid scenario', () => {
    const out = buildTalkBuddyScenario('Data Analyst', 'standard');
    const obj = JSON.parse(out.json);
    expect(obj.name).toBe('Mock Interview: Data Analyst');
    expect(obj.category).toBe('Interview Practice');
    expect(obj.difficulty).toBe('intermediate');
    expect(typeof obj.estimatedMinutes).toBe('number');
    expect(obj.estimatedMinutes).toBeGreaterThan(0);
    expect(typeof obj.systemPrompt).toBe('string');
    expect(typeof obj.initialMessage).toBe('string');
    expect(Array.isArray(obj.tags)).toBe(true);
  });

  it('maps friendly to beginner', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('X', 'friendly').json);
    expect(obj.difficulty).toBe('beginner');
  });

  it('maps standard to intermediate', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('X', 'standard').json);
    expect(obj.difficulty).toBe('intermediate');
  });

  it('maps tough to advanced', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('X', 'tough').json);
    expect(obj.difficulty).toBe('advanced');
  });

  it('system prompt includes the target name and all 5 phases', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('Data Analyst', 'standard').json);
    expect(obj.systemPrompt).toContain('Data Analyst');
    expect(obj.systemPrompt).toContain('WARM-UP');
    expect(obj.systemPrompt).toContain('BEHAVIOURAL');
    expect(obj.systemPrompt).toContain('ROLE-SPECIFIC');
    expect(obj.systemPrompt).toContain('YOUR QUESTIONS');
    expect(obj.systemPrompt).toContain('WRAP-UP');
  });

  it('initial message includes the target name', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('Data Analyst', 'standard').json);
    expect(obj.initialMessage).toContain('Data Analyst');
  });

  it('tags include interview and slugified target', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('Data Analyst', 'standard').json);
    expect(obj.tags).toContain('interview');
    expect(obj.tags).toContain('career-compass');
    expect(obj.tags).toContain('data-analyst');
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm run test -- lib/talk-buddy-export.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/talk-buddy-export.ts`**

```ts
import type { InterviewDifficulty } from './session-store';
import { PHASE_ORDER, PHASE_CONFIG } from './interview-phases';

const DIFFICULTY_MAP: Record<InterviewDifficulty, 'beginner' | 'intermediate' | 'advanced'> = {
  friendly: 'beginner',
  standard: 'intermediate',
  tough: 'advanced',
};

const DIFFICULTY_LABEL: Record<InterviewDifficulty, string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

const DIFFICULTY_TONE_LOCAL: Record<InterviewDifficulty, string> = {
  friendly: 'Be encouraging and warm. Use gentle follow-ups.',
  standard: 'Be neutral and professional, like a real first-round phone screen.',
  tough: 'Be pointed and direct. Push back on vague answers with "What specifically did YOU do?"',
};

export type TalkBuddyExport = {
  filename: string;
  json: string;
};

export function buildTalkBuddyScenario(
  target: string,
  difficulty: InterviewDifficulty
): TalkBuddyExport {
  const totalTurns = PHASE_ORDER.reduce(
    (n, p) => n + PHASE_CONFIG[p].turnsPerPhase,
    0
  );
  const estimatedMinutes = Math.max(8, Math.round(totalTurns * 1.8));

  const scenario = {
    name: `Mock Interview: ${target}`,
    description: `${DIFFICULTY_LABEL[difficulty]}-difficulty practice interview for a ${target} role. ${totalTurns} questions across 5 phases (warm-up, behavioural, role-specific, your questions, wrap-up).`,
    category: 'Interview Practice',
    difficulty: DIFFICULTY_MAP[difficulty],
    estimatedMinutes,
    systemPrompt: buildExportedSystemPrompt(target, difficulty),
    initialMessage: `Hi, thanks for taking the time to chat today. Let's start with a simple one — tell me a little about yourself and what brings you to a ${target} role.`,
    tags: ['interview', 'career-compass', slugify(target)],
  };

  return {
    filename: `mock-interview-${slugify(target)}.json`,
    json: JSON.stringify(scenario, null, 2),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function buildExportedSystemPrompt(target: string, difficulty: InterviewDifficulty): string {
  return `You are conducting a practice job interview for the role of ${target}. The student is using this to prepare for real interviews.

DIFFICULTY: ${difficulty}
${DIFFICULTY_TONE_LOCAL[difficulty]}

INTERVIEW STRUCTURE — walk through these 5 phases in order:

1. WARM-UP (1 question): One easy intro like "Tell me about yourself."
2. BEHAVIOURAL (2 questions): STAR-method situational questions targeting soft skills.
3. ROLE-SPECIFIC (2 questions): Questions tied to the actual ${target} role — technical or domain depending on the role.
4. YOUR QUESTIONS (1 turn): Invite the student to ask questions back about the role or team. Respond naturally.
5. WRAP-UP (1 question): Thank them for their time and politely close the interview.

GLOBAL RULES:
- Ask exactly ONE question per message. Wait for the student's answer.
- Do not give feedback during the interview. Stay in character.
- Reference specific things from the conversation in your follow-ups.
- Do not break character. Do not say "as an AI."
- Keep messages short — 2-4 sentences max.

This is a practice interview created in Career Compass and exported to Talk Buddy for voice rehearsal.`;
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm run test -- lib/talk-buddy-export.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/talk-buddy-export.ts lib/talk-buddy-export.test.ts
git commit -m "Add Talk Buddy scenario export helper"
```

---

## Task 7: download helper + markdown export extension

**Files:**
- Create: `lib/download.ts`
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

`lib/download.ts` is a one-line browser helper. No tests (touches `document` and `URL.createObjectURL`).

- [ ] **Step 1: Create `lib/download.ts`**

```ts
/**
 * Triggers a browser download for a JSON string. Used by the Talk Buddy
 * export buttons. No-op in environments without `document` (e.g. SSR).
 */
export function downloadJsonFile(filename: string, json: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Write the failing tests for the markdown extension**

Read `lib/markdown-export.test.ts` first to see the existing structure. Append a new `describe` block:

```ts
import type { InterviewFeedback } from './session-store';

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
```

You'll also need to add the `interviewFeedbackToMarkdown` import at the top of the test file alongside the existing imports:

```ts
import {
  gapAnalysisToMarkdown,
  learningPathToMarkdown,
  interviewFeedbackToMarkdown,
} from './markdown-export';
```

- [ ] **Step 3: Verify the new tests fail**

Run: `npm run test -- lib/markdown-export.test.ts`
Expected: FAIL — `interviewFeedbackToMarkdown` is not exported.

- [ ] **Step 4: Add the function to `lib/markdown-export.ts`**

Read the file first. Add this import at the top alongside the existing type imports:

```ts
import type { InterviewFeedback, InterviewPhase } from './session-store';
```

Append to the file (after the existing exports):

```ts
const RATING_LABEL: Record<InterviewFeedback['overallRating'], string> = {
  'developing': 'Developing',
  'on-track': 'On track',
  'strong': 'Strong',
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};

const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

export function interviewFeedbackToMarkdown(f: InterviewFeedback): string {
  const lines: string[] = [];

  lines.push(`# Interview Feedback: ${f.target}`);
  lines.push('');
  lines.push(`**Difficulty:** ${DIFFICULTY_LABEL[f.difficulty]}`);
  lines.push(`**Overall rating:** ${RATING_LABEL[f.overallRating]}`);
  lines.push('');
  lines.push(f.summary);
  lines.push('');

  if (f.strengths.length > 0) {
    lines.push('## What you did well');
    for (const s of f.strengths) {
      lines.push(`- ${s}`);
    }
    lines.push('');
  }

  lines.push('## What to work on');
  lines.push('');
  f.improvements.forEach((imp, idx) => {
    lines.push(`### ${idx + 1}. ${imp.area}`);
    if (imp.why) lines.push(`**Why it matters:** ${imp.why}`);
    if (imp.example) {
      lines.push(`**Example reframe of your answer:**`);
      lines.push(`> ${imp.example}`);
    }
    lines.push('');
  });

  if (f.perPhase.length > 0) {
    lines.push('## By phase');
    for (const p of f.perPhase) {
      lines.push(`- **${PHASE_LABEL[p.phase]}:** ${p.note}`);
    }
    lines.push('');
  }

  if (f.nextSteps.length > 0) {
    lines.push('## Next steps');
    f.nextSteps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    lines.push('');
  }

  lines.push('*AI-generated feedback. Treat as one perspective, not a verdict.*');

  return lines.join('\n');
}
```

- [ ] **Step 5: Verify the tests pass**

Run: `npm run test -- lib/markdown-export.test.ts`
Expected: PASS — all existing tests plus the 7 new ones.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/download.ts lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "Add download helper and interviewFeedbackToMarkdown export"
```

---

## Task 8: /api/interview route

**Files:**
- Create: `app/api/interview/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildInterviewSystemPrompt } from '@/lib/prompts/interview';
import { buildContextBlock } from '@/lib/context-block';
import { nextPhase } from '@/lib/interview-phases';
import { isTokenLimitError } from '@/lib/token-limit';
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewPhase,
  StudentProfile,
} from '@/lib/session-store';

interface InterviewRequest {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  phase: InterviewPhase;
  turnInPhase: number;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile | null;
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const MESSAGE_TRIM_COUNT = 20;

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null
) {
  const filtered = messages.filter((m) => m.kind === 'message');
  const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];
  if (contextBlock) {
    out.push({ role: 'system', content: contextBlock });
  }
  for (const m of filtered) {
    out.push({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      target,
      difficulty,
      phase,
      turnInPhase,
      resumeText,
      freeText,
      jobTitle,
      jobAdvert,
      distilledProfile,
      llmConfig: clientConfig,
    } = (await request.json()) as InterviewRequest;

    if (!target || !target.trim()) {
      return new Response(
        JSON.stringify({ error: 'A target is required to start an interview.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildInterviewSystemPrompt({
      target,
      difficulty,
      phase,
      turnInPhase,
    });

    const fullContext = buildContextBlock(
      resumeText,
      freeText,
      jobTitle,
      jobAdvert,
      distilledProfile ?? undefined
    );

    console.log('[interview] incoming:', {
      target,
      difficulty,
      phase,
      turnInPhase,
      messageCount: messages?.length,
      hasContextBlock: !!fullContext,
    });

    let trimmed = false;
    let reply: string;

    try {
      reply = await provider.createCompletion(
        toProviderMessages(messages, systemPrompt, fullContext),
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      // First retry: trim job advert
      let trimmedJobAdvert = jobAdvert;
      if (jobAdvert && jobAdvert.length > ADVERT_TRIM_CHARS) {
        trimmedJobAdvert = jobAdvert.slice(0, ADVERT_TRIM_CHARS);
      }
      const trimmedContext = buildContextBlock(
        resumeText,
        freeText,
        jobTitle,
        trimmedJobAdvert,
        distilledProfile ?? undefined
      );

      try {
        reply = await provider.createCompletion(
          toProviderMessages(messages, systemPrompt, trimmedContext),
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        // Second retry: trim message history to last 20
        const shortMessages = messages.slice(-MESSAGE_TRIM_COUNT);
        reply = await provider.createCompletion(
          toProviderMessages(shortMessages, systemPrompt, trimmedContext),
          llmConfig
        );
      }
    }

    const next = nextPhase(phase, turnInPhase);
    return new Response(
      JSON.stringify({
        reply,
        nextPhase: next.phase,
        nextTurnInPhase: next.turnInPhase,
        isComplete: next.isComplete,
        trimmed,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[interview] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: all PASS (no new tests, but ensure nothing broke).

- [ ] **Step 4: Commit**

```bash
git add app/api/interview/route.ts
git commit -m "Add /api/interview route with phase advancement and trim fallback"
```

---

## Task 9: /api/interviewFeedback route

**Files:**
- Create: `app/api/interviewFeedback/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildFeedbackPrompt, parseFeedback } from '@/lib/prompts/interview-feedback';
import { isTokenLimitError } from '@/lib/token-limit';
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewPhase,
} from '@/lib/session-store';

interface FeedbackRequest {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  reachedPhase: InterviewPhase | null;
  llmConfig?: LLMConfig;
}

const MESSAGE_TRIM_COUNT = 30;

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      target,
      difficulty,
      reachedPhase,
      llmConfig: clientConfig,
    } = (await request.json()) as FeedbackRequest;

    if (!target || !target.trim()) {
      return new Response(
        JSON.stringify({ error: 'A target is required to generate feedback.' }),
        { status: 400 }
      );
    }
    const userMessageCount = messages.filter(
      (m) => m.role === 'user' && m.kind === 'message'
    ).length;
    if (userMessageCount === 0) {
      return new Response(
        JSON.stringify({ error: 'No interview transcript to evaluate.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[interviewFeedback] incoming:', {
      target,
      difficulty,
      reachedPhase,
      messageCount: messages.length,
      userMessageCount,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content: 'You are an interview coach that ONLY responds in JSON.',
          },
          {
            role: 'user',
            content: buildFeedbackPrompt({ target, difficulty, messages, reachedPhase }),
          },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shortMessages = messages.slice(-MESSAGE_TRIM_COUNT);
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content: 'You are an interview coach that ONLY responds in JSON.',
          },
          {
            role: 'user',
            content: `NOTE: This is the most recent portion of a longer transcript. Earlier messages were dropped to fit the token budget. Acknowledge this in your summary.\n\n${buildFeedbackPrompt({ target, difficulty, messages: shortMessages, reachedPhase })}`,
          },
        ],
        llmConfig
      );
    }

    const feedback = parseFeedback(raw);
    return new Response(JSON.stringify({ feedback, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[interviewFeedback] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check + tests**

Run: `npx tsc --noEmit` and `npm run test`
Expected: clean and all PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/interviewFeedback/route.ts
git commit -m "Add /api/interviewFeedback route with trim fallback"
```

---

## Task 10: ChatComposer optional onPaperclip

**Files:**
- Modify: `components/chat/ChatComposer.tsx`

- [ ] **Step 1: Read the file and update the props type**

Read `components/chat/ChatComposer.tsx`. Find the `Props` type. It currently looks like:

```tsx
type Props = {
  onSend: (text: string) => void;
  onPaperclip: () => void;
  disabled?: boolean;
};
```

Change `onPaperclip` to optional:

```tsx
type Props = {
  onSend: (text: string) => void;
  onPaperclip?: () => void;
  disabled?: boolean;
};
```

- [ ] **Step 2: Conditionally render the paperclip button**

Find the JSX that renders the paperclip button (it'll be a `<Button>` with a `Paperclip` lucide icon and an `onClick={onPaperclip}` prop). Wrap it in a conditional:

```tsx
{onPaperclip && (
  <Button
    type='button'
    variant='outline'
    onClick={onPaperclip}
    disabled={disabled}
    aria-label='Attach'
  >
    <Paperclip className='w-4 h-4' />
  </Button>
)}
```

If the existing implementation has additional classes or attributes, keep them; only the wrapping conditional is new.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. The existing chat page that passes `onPaperclip` still works because the prop is still accepted, just optional now.

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/chat/ChatComposer.tsx
git commit -m "Make ChatComposer onPaperclip optional

The interview chat doesn't expose attachments mid-session; the
context block is set up in advance and stays stable for the
whole interview."
```

---

## Task 11: InterviewPhaseProgress component

**Files:**
- Create: `components/interview/InterviewPhaseProgress.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { InterviewPhase } from '@/lib/session-store';
import { PHASE_ORDER } from '@/lib/interview-phases';

type Props = {
  currentPhase: InterviewPhase | null;
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};

export default function InterviewPhaseProgress({ currentPhase }: Props) {
  const currentIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : PHASE_ORDER.length;

  return (
    <div className='flex items-center gap-1.5'>
      {PHASE_ORDER.map((phase, idx) => {
        let dotClass: string;
        if (idx < currentIdx) {
          dotClass = 'bg-accent';
        } else if (idx === currentIdx) {
          dotClass = 'bg-accent/50 ring-2 ring-accent/30';
        } else {
          dotClass = 'bg-border';
        }
        return (
          <div
            key={phase}
            className={`w-2 h-2 rounded-full ${dotClass}`}
            title={PHASE_LABEL[phase]}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/interview/InterviewPhaseProgress.tsx
git commit -m "Add InterviewPhaseProgress component (5 dots)"
```

---

## Task 12: InterviewImprovementItem component

**Files:**
- Create: `components/interview/InterviewImprovementItem.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { InterviewImprovement } from '@/lib/session-store';

type Props = {
  improvement: InterviewImprovement;
  index: number;
  expanded: boolean;
  onToggle: () => void;
};

export default function InterviewImprovementItem({
  improvement,
  index,
  expanded,
  onToggle,
}: Props) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const isTop = index === 0;

  return (
    <div className='border border-border rounded-lg bg-paper'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent-soft transition-colors duration-[250ms]'
        aria-expanded={expanded}
      >
        <Chevron className='w-4 h-4 text-ink-quiet flex-shrink-0' />
        {isTop && (
          <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-accent flex-shrink-0'>
            [TOP]
          </span>
        )}
        <span className='text-ink font-medium flex-1'>{improvement.area}</span>
      </button>
      {expanded && (
        <div className='border-t border-border px-4 py-4 space-y-3'>
          {improvement.why && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Why it matters
              </div>
              <p className='text-ink-muted leading-relaxed'>{improvement.why}</p>
            </div>
          )}
          {improvement.example && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Example reframe of your answer
              </div>
              <p className='text-ink-muted leading-relaxed italic border-l-2 border-accent/40 pl-3'>
                {improvement.example}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/interview/InterviewImprovementItem.tsx
git commit -m "Add collapsible InterviewImprovementItem component"
```

---

## Task 13: InterviewSetupCard component

**Files:**
- Create: `components/interview/InterviewSetupCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionStore, type InterviewDifficulty } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { buildTalkBuddyScenario } from '@/lib/talk-buddy-export';
import { downloadJsonFile } from '@/lib/download';

type Props = {
  initialTarget: string;
};

const DIFFICULTY_OPTIONS: {
  value: InterviewDifficulty;
  label: string;
  description: string;
}[] = [
  { value: 'friendly', label: 'Friendly', description: 'Encouraging tone, gentle follow-ups' },
  { value: 'standard', label: 'Standard', description: 'Realistic first-round phone screen' },
  { value: 'tough', label: 'Tough', description: 'Pointed questions, expects clear answers' },
];

export default function InterviewSetupCard({ initialTarget }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [target, setTarget] = useState(initialTarget);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>(store.interviewDifficulty);
  const [starting, setStarting] = useState(false);
  const [missingTarget, setMissingTarget] = useState(false);

  function handleDifficultyChange(d: InterviewDifficulty) {
    setDifficulty(d);
    store.setInterviewDifficulty(d);
  }

  function handleTargetChange(value: string) {
    setTarget(value);
    if (value.trim()) setMissingTarget(false);
    store.setJobTitle(value);
  }

  function handleExportToTalkBuddy() {
    const trimmed = target.trim();
    if (!trimmed) {
      setMissingTarget(true);
      return;
    }
    const { filename, json } = buildTalkBuddyScenario(trimmed, difficulty);
    downloadJsonFile(filename, json);
    toast.success('Scenario downloaded. Open Talk Buddy and use Upload.');
  }

  async function handleBegin() {
    const trimmed = target.trim();
    if (!trimmed) {
      setMissingTarget(true);
      return;
    }
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setStarting(true);
    try {
      const llmConfig = await loadLLMConfig();
      const state = useSessionStore.getState();
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          target: trimmed,
          difficulty,
          phase: 'warm-up',
          turnInPhase: 0,
          resumeText: state.resumeText ?? undefined,
          freeText: state.freeText || undefined,
          jobTitle: state.jobTitle || undefined,
          jobAdvert: state.jobAdvert || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not start the interview');
      }
      const { reply, nextPhase: nextP, nextTurnInPhase } = (await res.json()) as {
        reply: string;
        nextPhase: any;
        nextTurnInPhase: number;
      };
      store.setInterviewSession(trimmed, difficulty);
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextP, nextTurnInPhase);
      // The page re-renders into the chat view because interviewMessages.length > 0
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not start the interview');
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto px-6 py-12'>
      <div className='border border-border rounded-lg bg-paper p-8 space-y-6'>
        <div>
          <div className='editorial-rule'>
            <span>Practice interview</span>
          </div>
          <h1 className='text-[var(--text-2xl)] font-semibold text-ink'>
            Set up your interview
          </h1>
        </div>

        <div>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Target role
          </label>
          <Input
            value={target}
            onChange={(e) => handleTargetChange(e.target.value)}
            placeholder='e.g., Data Analyst'
            className={missingTarget ? 'ring-2 ring-error' : ''}
          />
          <p className='text-[var(--text-xs)] text-ink-quiet mt-1 italic'>
            Pre-filled from your inputs. Edit if you want a different role.
          </p>
        </div>

        <div>
          <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-2'>
            Difficulty
          </div>
          <div className='space-y-2'>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className='flex items-start gap-3 cursor-pointer'
              >
                <input
                  type='radio'
                  name='difficulty'
                  value={opt.value}
                  checked={difficulty === opt.value}
                  onChange={() => handleDifficultyChange(opt.value)}
                  className='mt-1'
                />
                <div>
                  <div className='text-ink font-medium'>{opt.label}</div>
                  <div className='text-[var(--text-sm)] text-ink-muted'>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className='border-t border-border pt-4 text-[var(--text-sm)] text-ink-muted'>
          Around 7 questions across 5 phases (warm-up, behavioural, role-specific, your questions, wrap-up). Roughly 10-15 minutes. Your transcript stays on this device.
        </div>

        <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4'>
          <Button variant='outline' onClick={() => router.push('/')}>
            ← Back
          </Button>
          <Button
            variant='outline'
            onClick={handleExportToTalkBuddy}
            title='Save as a Talk Buddy scenario for voice practice. Talk Buddy starts fresh each time — only the scenario is exported, not your transcript.'
          >
            <Download className='w-4 h-4 mr-2' />
            Export to Talk Buddy
          </Button>
          <Button onClick={handleBegin} disabled={starting}>
            {starting ? 'Starting…' : 'Begin interview →'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/interview/InterviewSetupCard.tsx
git commit -m "Add InterviewSetupCard with target, difficulty, and Talk Buddy export"
```

---

## Task 14: InterviewChat component

**Files:**
- Create: `components/interview/InterviewChat.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import InterviewPhaseProgress from './InterviewPhaseProgress';
import { useSessionStore, type InterviewFeedback, type InterviewPhase } from '@/lib/session-store';
import { loadLLMConfig } from '@/lib/llm-client';

const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

type Props = {
  onFeedbackReady: () => void;
};

export default function InterviewChat({ onFeedbackReady }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [sending, setSending] = useState(false);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const target = store.interviewTarget ?? '';
  const difficulty = store.interviewDifficulty;
  const messages = store.interviewMessages;
  const phase = store.interviewPhase;

  async function generateFeedback(reachedPhase: InterviewPhase | null) {
    setGeneratingFeedback(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/interviewFeedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          target,
          difficulty,
          reachedPhase,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not generate feedback');
      }
      const { feedback } = (await res.json()) as { feedback: InterviewFeedback };
      store.setInterviewFeedback(feedback);
      onFeedbackReady();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not generate feedback');
    } finally {
      setGeneratingFeedback(false);
    }
  }

  async function handleSend(text: string) {
    store.addInterviewMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const llmConfig = await loadLLMConfig();
      const state = useSessionStore.getState();
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.interviewMessages,
          target: state.interviewTarget ?? '',
          difficulty: state.interviewDifficulty,
          phase: state.interviewPhase,
          turnInPhase: state.interviewTurnInPhase,
          resumeText: state.resumeText ?? undefined,
          freeText: state.freeText || undefined,
          jobTitle: state.jobTitle || undefined,
          jobAdvert: state.jobAdvert || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'The interviewer could not respond');
      }
      const { reply, nextPhase: nextP, nextTurnInPhase, isComplete } =
        (await res.json()) as {
          reply: string;
          nextPhase: InterviewPhase | null;
          nextTurnInPhase: number;
          isComplete: boolean;
        };
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextP, nextTurnInPhase);
      if (isComplete) {
        // Auto-trigger feedback after wrap-up
        await generateFeedback('wrap-up');
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? `${err.message}. Try sending again.`
          : 'The interviewer couldn\'t respond. Try sending again.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleEndInterview() {
    if (!confirm('End the interview now and get feedback?')) return;
    generateFeedback(phase);
  }

  function handleReconfigure() {
    if (!confirm('Discard this interview and start over from the setup card?')) return;
    store.resetInterview();
  }

  return (
    <div className='h-full flex flex-col'>
      <div className='border-b border-border px-6 py-3 flex items-center gap-4 flex-shrink-0'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline text-[var(--text-sm)]'>
          ← Back to landing
        </Link>
        <div className='flex-1 flex items-center gap-3'>
          <span className='text-[var(--text-sm)] text-ink'>
            Practice interview · {target} · {DIFFICULTY_LABEL[difficulty]}
          </span>
          {phase && <InterviewPhaseProgress currentPhase={phase} />}
        </div>
        <button
          onClick={handleReconfigure}
          className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
        >
          Reconfigure
        </button>
        <Button variant='outline' onClick={handleEndInterview} disabled={sending || generatingFeedback}>
          End interview
        </Button>
      </div>

      <ChatMessageList messages={messages} />

      {generatingFeedback && (
        <div className='flex-shrink-0 border-t border-border px-6 py-3 text-[var(--text-sm)] text-ink-muted text-center'>
          Generating feedback…
        </div>
      )}

      <ChatComposer
        onSend={handleSend}
        disabled={sending || generatingFeedback}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/interview/InterviewChat.tsx
git commit -m "Add InterviewChat with phase progress, end interview, and reconfigure"
```

---

## Task 15: InterviewFeedbackView component

**Files:**
- Create: `components/interview/InterviewFeedbackView.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import InterviewImprovementItem from './InterviewImprovementItem';
import {
  useSessionStore,
  type InterviewFeedback,
  type InterviewPhase,
} from '@/lib/session-store';
import { interviewFeedbackToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig } from '@/lib/llm-client';
import { buildTalkBuddyScenario } from '@/lib/talk-buddy-export';
import { downloadJsonFile } from '@/lib/download';

type Props = {
  feedback: InterviewFeedback;
};

const RATING_LABEL: Record<InterviewFeedback['overallRating'], string> = {
  'developing': 'Developing',
  'on-track': 'On track',
  'strong': 'Strong',
};

const RATING_DOTS: Record<InterviewFeedback['overallRating'], string> = {
  'developing': '●○○',
  'on-track': '●●○',
  'strong': '●●●',
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};

const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

export default function InterviewFeedbackView({ feedback }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [practising, setPractising] = useState(false);

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    feedback.improvements.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded = feedback.improvements.every((_, i) => expanded[i]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  function handleExportToTalkBuddy() {
    const { filename, json } = buildTalkBuddyScenario(feedback.target, feedback.difficulty);
    downloadJsonFile(filename, json);
    toast.success('Scenario downloaded. Open Talk Buddy and use Upload.');
  }

  async function handlePracticeAgain() {
    if (
      !confirm(
        'Start a new interview for the same target and difficulty? Your current feedback will be cleared.'
      )
    ) {
      return;
    }
    setPractising(true);
    try {
      const target = feedback.target;
      const difficulty = feedback.difficulty;
      store.resetInterview();
      const llmConfig = await loadLLMConfig();
      const state = useSessionStore.getState();
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          target,
          difficulty,
          phase: 'warm-up',
          turnInPhase: 0,
          resumeText: state.resumeText ?? undefined,
          freeText: state.freeText || undefined,
          jobTitle: state.jobTitle || undefined,
          jobAdvert: state.jobAdvert || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not restart the interview');
      }
      const { reply, nextPhase, nextTurnInPhase } = (await res.json()) as {
        reply: string;
        nextPhase: InterviewPhase | null;
        nextTurnInPhase: number;
      };
      store.setInterviewSession(target, difficulty);
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextPhase, nextTurnInPhase);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not restart');
    } finally {
      setPractising(false);
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-6 py-8 space-y-8'>
      <div className='flex items-center gap-3'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline text-[var(--text-sm)]'>
          ← Back to landing
        </Link>
        <div className='flex-1' />
        <span className='text-[var(--text-sm)] text-ink-muted'>
          Practice interview · {feedback.target} · {DIFFICULTY_LABEL[feedback.difficulty]}
        </span>
      </div>

      <div>
        <div className='editorial-rule'>
          <span>Interview feedback</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          Overall: {RATING_LABEL[feedback.overallRating]}{' '}
          <span className='text-accent ml-2'>{RATING_DOTS[feedback.overallRating]}</span>
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{feedback.summary}</p>
      </div>

      {feedback.strengths.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>What you did well</h2>
          <ul className='space-y-1'>
            {feedback.strengths.map((s, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>What to work on</h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Hide all details' : 'Show all details'}
          </button>
        </div>
        <div className='space-y-2'>
          {feedback.improvements.map((imp, i) => (
            <InterviewImprovementItem
              key={i}
              improvement={imp}
              index={i}
              expanded={!!expanded[i]}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>

      {feedback.perPhase.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>By phase</h2>
          <div className='space-y-2'>
            {feedback.perPhase.map((p, i) => (
              <div key={i} className='flex items-start gap-3'>
                <span className='text-ink font-medium min-w-[140px]'>
                  {PHASE_LABEL[p.phase]}
                </span>
                <span className='text-ink-muted flex-1'>{p.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.nextSteps.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Next steps</h2>
          <ol className='list-decimal ml-5 space-y-1'>
            {feedback.nextSteps.map((step, i) => (
              <li key={i} className='text-ink-muted leading-relaxed'>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-6'>
        <CopyMarkdownButton getMarkdown={() => interviewFeedbackToMarkdown(feedback)} />
        <Button
          variant='outline'
          onClick={handleExportToTalkBuddy}
          title='Export this scenario to Talk Buddy for voice practice. Note: Talk Buddy starts fresh — your transcript and feedback don\'t transfer, only the role and difficulty.'
        >
          <Download className='w-4 h-4 mr-2' />
          Export to Talk Buddy
        </Button>
        <Button variant='outline' onClick={handlePracticeAgain} disabled={practising}>
          {practising ? 'Starting…' : 'Practice again'}
        </Button>
        <Button variant='outline' onClick={handleStartOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/interview/InterviewFeedbackView.tsx
git commit -m "Add InterviewFeedbackView with collapsible improvements and chain actions"
```

---

## Task 16: /interview page orchestrator

**Files:**
- Create: `app/interview/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import InterviewSetupCard from '@/components/interview/InterviewSetupCard';
import InterviewChat from '@/components/interview/InterviewChat';
import InterviewFeedbackView from '@/components/interview/InterviewFeedbackView';

export default function InterviewPage() {
  const store = useSessionStore();
  const messages = store.interviewMessages;
  const feedback = store.interviewFeedback;

  // State precedence: feedback > chat > setup card
  const showFeedback = !!feedback;
  const showChat = !showFeedback && messages.length > 0;
  const showSetupCard = !showFeedback && !showChat;

  // Pre-fill target for the setup card from existing inputs.
  // Job advert wins (if present, take its first non-empty line).
  // Otherwise fall back to jobTitle, then any prior interviewTarget.
  function deriveInitialTarget(): string {
    if (store.jobAdvert && store.jobAdvert.trim()) {
      const firstLine = store.jobAdvert.trim().split('\n').find((l) => l.trim());
      if (firstLine) return firstLine.slice(0, 100);
    }
    if (store.jobTitle && store.jobTitle.trim()) return store.jobTitle.trim();
    if (store.interviewTarget) return store.interviewTarget;
    return '';
  }

  return (
    <div className='h-full overflow-hidden'>
      {showSetupCard && <InterviewSetupCard initialTarget={deriveInitialTarget()} />}
      {showChat && <InterviewChat onFeedbackReady={() => { /* no-op; store change re-renders */ }} />}
      {showFeedback && feedback && <InterviewFeedbackView feedback={feedback} />}
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + manual smoke test**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run dev` and visit `http://localhost:3000/interview` in the Electron window or browser.
Expected: Setup card renders. Inputs zone is empty by default, so the target field is blank. Difficulty defaults to Standard. Don't try to "Begin interview" without a configured provider — it'll redirect to settings.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/interview/page.tsx
git commit -m "Add /interview page orchestrator (setup card / chat / feedback)"
```

---

## Task 17: ActionsZone — add Practice interview button

**Files:**
- Modify: `components/landing/ActionsZone.tsx`

- [ ] **Step 1: Read the current file**

Read `components/landing/ActionsZone.tsx`. It currently has 4 buttons (Find my careers, Start chatting, Gap analysis, Learning path) and a `MissingHints` import. We're adding a 5th.

- [ ] **Step 2: Add the imports**

Add `Mic` to the existing lucide-react import line:

```tsx
import { Compass, MessageCircle, SearchCheck, Route as RouteIcon, Mic } from 'lucide-react';
```

- [ ] **Step 3: Extend the ActionId type**

Find the line `type ActionId = 'careers' | 'chat' | 'gaps' | 'learn';` and change it to:

```tsx
type ActionId = 'careers' | 'chat' | 'gaps' | 'learn' | 'interview';
```

- [ ] **Step 4: Add the handler**

After `handleLearningPath`, add:

```tsx
async function handleInterview() {
  clearMissingHints();
  const hasTarget = !!store.jobAdvert.trim() || !!store.jobTitle.trim();
  if (!hasTarget) {
    setMissingHints({
      resume: false,
      jobTitle: true,
      aboutYou: false,
      jobAdvert: true,
      message: 'Practice interview needs a job. Paste a job advert or enter a job title.',
    });
    focusFirstHint();
    return;
  }
  // No LLM call here — the setup card on /interview is the universal preamble.
  // The student picks difficulty there before the first API call fires.
  router.push('/interview');
}
```

- [ ] **Step 5: Add the 5th button**

Find the JSX grid that holds the existing 4 buttons. It uses `grid-cols-2 md:grid-cols-4`. Change it to `md:grid-cols-5` to accommodate the 5th button:

```tsx
<div className='w-full max-w-5xl grid grid-cols-2 md:grid-cols-5 gap-3 mt-6'>
```

Add the new button at the END of the grid (after the Learning path button):

```tsx
<Button onClick={handleInterview} disabled={anyRunning} variant='outline' className='py-6'>
  <Mic className='w-4 h-4 mr-2' />
  Practice interview
</Button>
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/landing/ActionsZone.tsx
git commit -m "Add Practice interview button to ActionsZone"
```

---

## Task 18: CareerNode — add Practice interview button

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Read the current file**

Read `components/CareerNode.tsx`. It currently has 3 buttons in the dialog footer (from Phases 1 and 2): Chat about this, Analyse gaps for this role, Learning path for this role.

- [ ] **Step 2: Add the Mic icon to the imports**

Find the existing lucide-react import that has `MessageCircle, SearchCheck, Route as RouteIcon`. Add `Mic`:

```tsx
import { MessageCircle, SearchCheck, Route as RouteIcon, Mic } from 'lucide-react';
```

(If `Mic` is already imported elsewhere or the file uses a different import style, adapt accordingly. The important thing is `Mic` is in scope.)

- [ ] **Step 3: Add the handler**

After the existing `handleLearningPath` handler, add:

```tsx
function handlePracticeInterview() {
  if (!jobTitle) return;
  setStoreJobTitle(jobTitle);
  router.push('/interview');
}
```

(`router`, `setStoreJobTitle` are already in scope from the Phase 2 work.)

- [ ] **Step 4: Add the 4th button**

Find the dialog footer row with the existing 3 buttons. Add a 4th button after "Learning path for this role":

```tsx
<Button variant='outline' onClick={handlePracticeInterview} disabled={running !== null}>
  <Mic className='w-4 h-4 mr-2' />
  Practice interview for this role
</Button>
```

The footer already uses `flex-wrap` so it will wrap on narrow dialogs.

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/CareerNode.tsx
git commit -m "Add Practice interview shortcut button to career card"
```

---

## Task 19: GapAnalysisView and LearningPathView chain buttons

**Files:**
- Modify: `components/results/GapAnalysisView.tsx`
- Modify: `components/results/LearningPathView.tsx`

- [ ] **Step 1: Update `GapAnalysisView.tsx`**

Read the file first. Find the bottom action row with the existing chain button "Turn this into a learning path →".

Add `Mic` to the lucide-react imports if not already present.

Add a new chain handler after `handleChainToLearningPath`:

```tsx
function handlePracticeInterview() {
  router.push('/interview');
}
```

In the JSX, find the `<div className='flex justify-end'>` (or similar) that holds the "Turn this into a learning path" button. Add a new button BEFORE the existing one:

```tsx
<Button variant='outline' onClick={handlePracticeInterview}>
  Practice interview for this target →
</Button>
```

If the existing button is wrapped in a div with `flex justify-end`, change it to `flex flex-wrap justify-end gap-3` to fit two buttons cleanly on one row and wrap on narrow viewports.

- [ ] **Step 2: Update `LearningPathView.tsx`**

Read the file first. Same pattern — find the "Run gap analysis for this target →" chain button and add a "Practice interview for this target →" button alongside it.

Add `Mic` to imports if needed.

Add the handler:

```tsx
function handlePracticeInterview() {
  router.push('/interview');
}
```

In the JSX, find the row with the existing chain button (which is conditional on `hasProfile` for the gap analysis chain). The new "Practice interview" button should NOT be conditional on `hasProfile` — interviews work without a profile, just less personalised. Place it in its own non-conditional row OR refactor so the row is always rendered with both buttons (gap analysis only when `hasProfile`, interview always).

Recommended structure:

```tsx
<div className='flex flex-wrap justify-end gap-3'>
  {hasProfile && (
    <Button variant='outline' onClick={handleChainToGapAnalysis} disabled={chaining}>
      {chaining ? 'Analysing…' : 'Run gap analysis for this target →'}
    </Button>
  )}
  <Button variant='outline' onClick={handlePracticeInterview}>
    Practice interview for this target →
  </Button>
</div>
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/results/GapAnalysisView.tsx components/results/LearningPathView.tsx
git commit -m "Add Practice interview chain buttons to gap and learning path views"
```

---

## Task 20: OutputsBanner — interview labels

**Files:**
- Modify: `components/landing/OutputsBanner.tsx`

- [ ] **Step 1: Read the current file**

Read `components/landing/OutputsBanner.tsx`. It currently destructures `chatMessages, careers, gapAnalysis, learningPath` and renders quick-jump links for each.

- [ ] **Step 2: Add interview state to the destructure**

Update the destructure to include the new fields:

```tsx
  const {
    chatMessages,
    careers,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
  } = store;
```

- [ ] **Step 3: Compute the interview state flags**

After the existing flag computations (`hasCareers`, `hasChat`, `hasGap`, `hasPath`), add:

```tsx
  const hasInterviewFeedback = !!interviewFeedback;
  const hasInterviewInProgress =
    interviewMessages.length > 0 && !hasInterviewFeedback;
```

- [ ] **Step 4: Update the early-return condition**

Find the early return that hides the banner when nothing exists. Add the new flags:

```tsx
  if (
    !hasCareers &&
    !hasChat &&
    !hasGap &&
    !hasPath &&
    !hasInterviewInProgress &&
    !hasInterviewFeedback
  ) return null;
```

- [ ] **Step 5: Add the new links to the JSX**

Find the section that renders the existing links (`{hasCareers && (...)}`, `{hasChat && (...)}`, etc.). Add two new conditional links AFTER the learning path link:

```tsx
        {hasInterviewInProgress && (
          <Link href='/interview' className='underline hover:text-accent'>
            interview in progress
          </Link>
        )}
        {hasInterviewFeedback && (
          <Link href='/interview' className='underline hover:text-accent'>
            interview feedback ready
          </Link>
        )}
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/landing/OutputsBanner.tsx
git commit -m "Add interview labels to OutputsBanner"
```

---

## Task 21: Manual QA

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all PASS. Should be 100+ tests across all the new modules plus Phase 1 and Phase 2.

- [ ] **Step 2: Run the type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Walk the manual QA checklist in the Electron dev build**

Run: `npm run electron:dev`

Walk this list, ticking items as they pass:

- [ ] Landing: ActionsZone shows 5 buttons (Find my careers, Start chatting, Gap analysis, Learning path, Practice interview)
- [ ] Click "Practice interview" with no target → inline highlight on Job title and Job advert with the message *"Practice interview needs a job..."*
- [ ] Add a job title, click "Practice interview" → navigates to `/interview`, setup card shows with target pre-filled
- [ ] Setup card: change difficulty to Tough → store updates, persists if you go Back and return
- [ ] Setup card: edit target field → field updates
- [ ] Setup card: click "Export to Talk Buddy" → JSON file downloads, name is `mock-interview-{slug}.json`, opens in Talk Buddy via Upload, scenario appears in Talk Buddy's scenarios list
- [ ] Setup card: click "Begin interview" → first interviewer message appears within a few seconds, setup card disappears, chat surface shows
- [ ] Chat: top bar shows target chip, difficulty chip, 5 phase dots (warm-up should be filled or half-filled), Reconfigure link, End interview button
- [ ] Chat: send a response → interviewer replies, phase dots advance correctly through behavioural / role-specific / your-questions / wrap-up
- [ ] Chat: complete all 5 phases → wrap-up message → loading state appears → feedback panel renders
- [ ] Chat: send first response → phase advances to behavioural (since warm-up is 1 turn)
- [ ] Chat: in behavioural phase, send response → phase stays behavioural (turn 2 of 2), send second response → phase advances to role-specific
- [ ] Chat: click End interview mid-session → confirmation dialog → feedback generates → feedback panel acknowledges incomplete session in summary or per-phase notes
- [ ] Chat: click Reconfigure mid-session → confirmation → setup card reappears with target and difficulty preserved
- [ ] Feedback: rating dot indicator visible (●○○ / ●●○ / ●●●), summary, strengths, improvements compact
- [ ] Feedback: click an improvement row → expands to show why and example reframe
- [ ] Feedback: top improvement shows [TOP] marker
- [ ] Feedback: click "Show all details" → all improvements expand
- [ ] Feedback: per-phase notes visible (only for phases the student reached)
- [ ] Feedback: next steps numbered and ordered
- [ ] Feedback: Copy as Markdown → paste into a notes app, verify full content with example reframes preserved
- [ ] Feedback: Export to Talk Buddy → same JSON as setup card export (no transcript / feedback baked in)
- [ ] Feedback: Practice again → confirmation → fresh chat starts immediately with same target and difficulty (setup card skipped)
- [ ] Feedback: Start over → confirmation → store fully reset → returns to landing
- [ ] Career card: open dialog → 4 buttons in footer (Chat about, Analyse gaps, Learning path, Practice interview)
- [ ] Career card: click "Practice interview for this role" → navigates to `/interview` with target pre-filled
- [ ] Gap analysis page: bottom row has both "Practice interview for this target →" and "Turn this into a learning path →" buttons
- [ ] Gap analysis page: click "Practice interview for this target →" → navigates correctly
- [ ] Learning path page: bottom row has "Practice interview for this target →"
- [ ] Learning path page (without profile): click "Practice interview for this target →" → navigates correctly even with no profile
- [ ] Learning path page (with profile): both gap analysis and practice interview buttons visible
- [ ] OutputsBanner: while interview is in progress, "interview in progress" label appears with link to `/interview`
- [ ] OutputsBanner: after feedback generated, "interview feedback ready" appears, "in progress" disappears
- [ ] OutputsBanner: clicking either label resumes the correct surface (chat or feedback)
- [ ] Navigate away from `/interview` mid-session (e.g., click landing) → return → exact same state restored
- [ ] Navigate away after feedback → return → feedback panel still visible
- [ ] Reload Electron mid-interview (Cmd+R) → state lost (in-memory only — expected)
- [ ] Resume / about-you / job advert all show up in interviewer's questions when set (interviewer references them by name)
- [ ] Tough difficulty visibly probes harder than Friendly (compare warm-up + 1 behavioural in each)
- [ ] ChatComposer in /interview has NO paperclip button (the prop is omitted)
- [ ] Header and footer pinned across `/interview`, `/chat`, `/careers`, `/`, `/about`, `/settings` (regression check)
- [ ] Window can be dragged on macOS (regression check)

- [ ] **Step 4: Stop the Electron dev instance**

- [ ] **Step 5: Commit any fixes**

If any QA item fails and you fix it, commit each fix with a message like `Fix: <short description>` before marking the item complete.

- [ ] **Step 6: Final commit (only if no fixes were needed)**

If everything passed, no additional commit needed — F14 is complete.

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| New session store fields, types, and actions | Task 1 |
| `lib/context-block.ts` extracted from chat route, with tests, with `distilledProfile` support | Task 2 |
| `lib/interview-phases.ts` — phase config and `nextPhase()`, with tests | Task 3 |
| `lib/prompts/interview.ts` — interviewer system prompt builder, with tests | Task 4 |
| `lib/prompts/interview-feedback.ts` — feedback prompt + parser, with tests | Task 5 |
| `lib/talk-buddy-export.ts` — pure scenario builder, with tests | Task 6 |
| `lib/download.ts` — `downloadJsonFile` helper | Task 7 |
| `lib/markdown-export.ts` — `interviewFeedbackToMarkdown` extension, with tests | Task 7 |
| `app/api/interview/route.ts` — per-turn endpoint with phase advancement and trim retry | Task 8 |
| `app/api/interviewFeedback/route.ts` — one-shot feedback endpoint with trim retry | Task 9 |
| `ChatComposer.onPaperclip` becomes optional, button hides when undefined | Task 10 |
| `InterviewPhaseProgress.tsx` — 5 dots component | Task 11 |
| `InterviewImprovementItem.tsx` — collapsible improvement row | Task 12 |
| `InterviewSetupCard.tsx` — pre-start form with target, difficulty, Talk Buddy export, Begin interview | Task 13 |
| `InterviewChat.tsx` — top bar, message list, composer, end / reconfigure | Task 14 |
| `InterviewFeedbackView.tsx` — feedback panel with copy / export / practice again / start over | Task 15 |
| `app/interview/page.tsx` — orchestrator state machine | Task 16 |
| `ActionsZone` — 5th button "Practice interview" with missing-input prompting | Task 17 |
| `CareerNode` — 4th button "Practice interview for this role" | Task 18 |
| `GapAnalysisView` and `LearningPathView` chain buttons | Task 19 |
| `OutputsBanner` — interview-in-progress and interview-feedback-ready labels | Task 20 |
| Manual QA covering all flows | Task 21 |

No gaps. Type names are consistent throughout: `InterviewDifficulty`, `InterviewPhase`, `InterviewImprovement`, `InterviewFeedback`, `InterviewPromptInput`, `FeedbackPromptInput`, `TalkBuddyExport`, `PhaseConfig`. Component prop names match between callers and definitions.
