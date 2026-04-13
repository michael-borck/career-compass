# Phase 2 — Gap Analysis, Learning Path, and Unified Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of Career Compass: gap analysis (F7), learning path generator (F9), job advert reverse workflow (F4), and a landing-page redesign that collapses Phase 1's two-card layout into a unified inputs+actions surface.

**Architecture:** New `jobAdvert` input + two new output types (`GapAnalysis`, `LearningPath`) added to the existing Zustand session store. Two new API routes (`/api/gapAnalysis`, `/api/learningPath`) follow the same thin-wrapper pattern as Phase 1's chat and distillation routes, delegating prompt construction to pure helpers under `lib/prompts/`. Two new pages (`/gap-analysis`, `/learning-path`) read from the store and render collapsible-detail views with copy-to-Markdown export. The landing page replaces UploadCard + ChatCard with `InputsZone` + `ActionsZone` + `OutputsBanner`. Career cards in the spider graph gain shortcut buttons that run gap analysis and learning path directly. The Phase 1 `pendingChatMessage` mechanism is removed (the new model never needs it).

**Tech Stack:** Next.js 14 App Router · TypeScript · Zustand · Vitest · existing Tailwind / Radix / react-hot-toast / ReactFlow stack. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-04-13-phase2-gap-analysis-learning-path-design.md`

---

## Notes for the implementer

- **Build on Phase 1.** Everything from Phase 1 is shipped and stable: session store, llm-client, llm-providers, chat route, distillation route, careers prompt builder, advisor prompt, trimHistory helper, all UI primitives, ReactFlow careers page, chat page with paperclip menu and profile review. Read `docs/superpowers/specs/2026-04-13-phase1-conversational-foundation-design.md` first if you need orientation.
- **TDD discipline.** For every pure function (prompt builders, parsers, markdown exporters, profile-text): write the test, run it to confirm it fails, implement, run it to confirm it passes, commit. UI components (.tsx) get manual QA only — no React rendering tests in this phase.
- **One commit per task minimum.** Smaller commits are fine if a task naturally subdivides.
- **Frequent type-checks.** After every task that touches `.ts`/`.tsx`, run `npx tsc --noEmit`. Expected: clean. If pre-existing errors appear in unrelated files, ignore them; only fix new errors introduced by your task.
- **All paths are absolute from the repo root** (`/Users/michael/Projects/career-compass/...`). Examples below omit the prefix.
- **Conventions to follow.** Studio Calm tokens (`bg-paper`, `border-border`, `text-ink`, `text-ink-muted`, `text-ink-quiet`, `bg-accent-soft`, `text-accent`, `text-error`, text sizes like `text-[var(--text-lg)]`). Lucide icons. `react-hot-toast` for transient messages. `useRouter` from `next/navigation`. Existing UI primitives in `components/ui/`.
- **Don't reformat unrelated files.** Only touch what each task lists.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/token-limit.ts` | Shared `isTokenLimitError` helper, extracted from inline copies in chat and distillProfile routes. |
| `lib/profile-text.ts` | `profileToReadableText(profile)` — turns a `StudentProfile` JSON into a human-readable paragraph for the "About you" pre-fill. |
| `lib/profile-text.test.ts` | Unit tests. |
| `lib/prompts/gaps.ts` | `buildGapAnalysisPrompt` + `parseGapAnalysis`. |
| `lib/prompts/gaps.test.ts` | Unit tests. |
| `lib/prompts/learningPath.ts` | `buildLearningPathPrompt` + `parseLearningPath`. |
| `lib/prompts/learningPath.test.ts` | Unit tests. |
| `lib/markdown-export.ts` | `gapAnalysisToMarkdown`, `learningPathToMarkdown`. |
| `lib/markdown-export.test.ts` | Unit tests (snapshot-style). |
| `app/api/gapAnalysis/route.ts` | POST endpoint. Thin wrapper. |
| `app/api/learningPath/route.ts` | POST endpoint. Thin wrapper. |
| `app/gap-analysis/page.tsx` | Reads from store, renders `<GapAnalysisView />`, empty/loading states. |
| `app/learning-path/page.tsx` | Same pattern for learning path. |
| `components/landing/InputsZone.tsx` | 4 inputs bound to session store, with About-you pre-fill effect. |
| `components/landing/ActionsZone.tsx` | 4 action buttons with inline missing-input prompting. |
| `components/landing/OutputsBanner.tsx` | Lists outputs that exist with quick-jump links. Replaces `SessionBanner`. |
| `components/results/GapAnalysisView.tsx` | Top-level gap analysis view. |
| `components/results/LearningPathView.tsx` | Top-level learning path view. |
| `components/results/GapItem.tsx` | Collapsible single-gap row. |
| `components/results/MilestoneItem.tsx` | Collapsible single-milestone row. |
| `components/results/CopyMarkdownButton.tsx` | Shared button + clipboard logic. |

### Modified files

| Path | Change |
|---|---|
| `lib/session-store.ts` | Add `jobAdvert`, `gapAnalysis`, `learningPath` fields, types (`Gap`, `GapAnalysis`, `LearningMilestone`, `LearningPath`, `GapSeverity`, `GapCategory`), and three new actions. Drop `pendingChatMessage` field, `setPendingChatMessage` action. `reset()` clears all of the above. |
| `lib/session-store.test.ts` | Update existing reset test to cover new fields. Add tests for new setters. |
| `lib/prompts/careers.ts` | `CareersInput` gains `jobAdvert?: string`. `buildCareersPrompt` and `buildCareerDetailPrompt` include a `<jobAdvert>` section when present. |
| `lib/prompts/careers.test.ts` | Add a test that `jobAdvert` appears in output when provided. |
| `app/api/chat/route.ts` | Replace inline `isTokenLimitError` with import from `lib/token-limit.ts`. `ChatRequest` gains `jobAdvert?: string`. `buildContextBlock` accepts and renders it. |
| `app/api/distillProfile/route.ts` | Replace inline `isTokenLimitError` with import from `lib/token-limit.ts`. |
| `app/api/getCareers/route.ts` | No code change required — `CareersInput` already passes through; just confirm `jobAdvert` flows through after Task 3. |
| `app/page.tsx` | Replace UploadCard + ChatCard with `InputsZone` + `ActionsZone`. Replace `SessionBanner` with `OutputsBanner`. |
| `app/chat/page.tsx` | Drop the `pendingChatMessage` auto-send-on-mount effect entirely. |
| `components/CareerNode.tsx` | Add two new buttons in the dialog footer: "Analyse gaps for this role" and "Learning path for this role". |

### Deleted files

- `components/landing/UploadCard.tsx` (collapsed into `InputsZone` + `ActionsZone`)
- `components/landing/ChatCard.tsx` (same)
- `components/landing/SessionBanner.tsx` (replaced by `OutputsBanner.tsx`)

---

## Task 1: Extend session store with Phase 2 types and fields

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Add types and fields**

Open `lib/session-store.ts`. Add the new types ABOVE the existing `StudentProfile` type:

```ts
export type GapSeverity = 'critical' | 'important' | 'nice-to-have';
export type GapCategory = 'technical' | 'experience' | 'qualification' | 'soft' | 'domain';

export type Gap = {
  title: string;
  category: GapCategory;
  severity: GapSeverity;
  why: string;
  targetLevel: string;
  currentLevel: string | null;
  evidenceIdeas: string[];
};

export type GapAnalysis = {
  target: string;
  summary: string;
  matches: string[];
  gaps: Gap[];
  realisticTimeline: string;
};

export type LearningMilestone = {
  weekRange: string;
  focus: string;
  activities: string[];
  outcome: string;
};

export type LearningPath = {
  target: string;
  summary: string;
  prerequisites: string[];
  milestones: LearningMilestone[];
  portfolioProject: string;
  totalDuration: string;
  caveats: string[];
};
```

In the `SessionState` type, add the new fields. Locate the `// Inputs` block and add `jobAdvert: string;` after `jobTitle`:

```ts
  // Inputs
  resumeText: string | null;
  resumeFilename: string | null;
  freeText: string;
  jobTitle: string;
  jobAdvert: string;
```

In the `// Outputs` block, add the two new output fields after `careers`:

```ts
  // Outputs
  distilledProfile: StudentProfile | null;
  careers: finalCareerInfo[] | null;
  selectedCareerId: string | null;
  gapAnalysis: GapAnalysis | null;
  learningPath: LearningPath | null;
```

In the actions list, REMOVE `setPendingChatMessage` (and the `pendingChatMessage` field — see Step 3 below) and ADD three new actions. Locate `setCareers` and add the new lines after it:

```ts
  setCareers: (careers: finalCareerInfo[] | null) => void;
  setJobAdvert: (text: string) => void;
  setGapAnalysis: (g: GapAnalysis | null) => void;
  setLearningPath: (l: LearningPath | null) => void;
  reset: () => void;
```

In the `// Chat` block, REMOVE the line `pendingChatMessage: string | null;`.

- [ ] **Step 2: Update initial state and actions**

In `initialState`, REMOVE `pendingChatMessage: null,` and ADD the new defaults:

```ts
const initialState = {
  resumeText: null,
  resumeFilename: null,
  freeText: '',
  jobTitle: '',
  jobAdvert: '',
  chatMessages: [],
  currentFocus: null,
  distilledProfile: null,
  careers: null,
  selectedCareerId: null,
  gapAnalysis: null,
  learningPath: null,
};
```

In the `create<SessionState>(...)` body, REMOVE the `setPendingChatMessage` line and ADD the three new actions next to `setCareers`:

```ts
  setCareers: (careers) => set({ careers }),
  setJobAdvert: (text) => set({ jobAdvert: text }),
  setGapAnalysis: (g) => set({ gapAnalysis: g }),
  setLearningPath: (l) => set({ learningPath: l }),
```

- [ ] **Step 3: Update existing tests for the new shape**

Open `lib/session-store.test.ts`. Find the `it('has empty initial state', ...)` test and add assertions for the new fields:

```ts
  it('has empty initial state', () => {
    const s = useSessionStore.getState();
    expect(s.resumeText).toBeNull();
    expect(s.resumeFilename).toBeNull();
    expect(s.freeText).toBe('');
    expect(s.jobTitle).toBe('');
    expect(s.jobAdvert).toBe('');
    expect(s.chatMessages).toEqual([]);
    expect(s.currentFocus).toBeNull();
    expect(s.distilledProfile).toBeNull();
    expect(s.careers).toBeNull();
    expect(s.selectedCareerId).toBeNull();
    expect(s.gapAnalysis).toBeNull();
    expect(s.learningPath).toBeNull();
  });
```

Find the `it('reset clears everything', ...)` test and extend it:

```ts
  it('reset clears everything', () => {
    const s = useSessionStore.getState();
    s.setResume('a', 'b');
    s.setFreeText('c');
    s.setJobTitle('d');
    s.setJobAdvert('e');
    s.addChatMessage({ role: 'user', content: 'f' });
    s.setFocus('g');
    s.setDistilledProfile({
      background: 'h', interests: [], skills: [], constraints: [], goals: [],
    });
    s.setGapAnalysis({
      target: 'X', summary: 'Y', matches: [], gaps: [], realisticTimeline: 'Z',
    });
    s.setLearningPath({
      target: 'X', summary: 'Y', prerequisites: [], milestones: [],
      portfolioProject: 'P', totalDuration: 'D', caveats: [],
    });
    s.reset();
    const after = useSessionStore.getState();
    expect(after.resumeText).toBeNull();
    expect(after.freeText).toBe('');
    expect(after.jobTitle).toBe('');
    expect(after.jobAdvert).toBe('');
    expect(after.chatMessages).toEqual([]);
    expect(after.currentFocus).toBeNull();
    expect(after.distilledProfile).toBeNull();
    expect(after.gapAnalysis).toBeNull();
    expect(after.learningPath).toBeNull();
  });
```

- [ ] **Step 4: Add new setter tests**

Append to the `describe('session store actions', ...)` block:

```ts
  it('setJobAdvert writes the field', () => {
    useSessionStore.getState().setJobAdvert('a posting');
    expect(useSessionStore.getState().jobAdvert).toBe('a posting');
  });

  it('setGapAnalysis writes the field', () => {
    const g = {
      target: 'Data Analyst',
      summary: 's',
      matches: ['m'],
      gaps: [{
        title: 'SQL', category: 'technical' as const, severity: 'critical' as const,
        why: 'w', targetLevel: 't', currentLevel: null, evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    };
    useSessionStore.getState().setGapAnalysis(g);
    expect(useSessionStore.getState().gapAnalysis).toEqual(g);
  });

  it('setLearningPath writes the field', () => {
    const l = {
      target: 'Data Analyst',
      summary: 's',
      prerequisites: ['p'],
      milestones: [{ weekRange: 'W1-2', focus: 'f', activities: ['a'], outcome: 'o' }],
      portfolioProject: 'pp',
      totalDuration: '12 weeks',
      caveats: ['c'],
    };
    useSessionStore.getState().setLearningPath(l);
    expect(useSessionStore.getState().learningPath).toEqual(l);
  });
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- lib/session-store.test.ts`
Expected: PASS — all existing tests plus the 3 new ones.

If a test fails because some other Phase 1 test referenced `pendingChatMessage`, remove that reference (it's a stale assertion).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: Some pre-existing files (`app/chat/page.tsx`, `components/landing/ChatCard.tsx`) will now have errors because they reference `pendingChatMessage` / `setPendingChatMessage` which we just removed. **Leave those broken for now** — Tasks 18 (ChatCard delete) and 20 (chat page cleanup) will fix them. Note the failing files in your commit message.

- [ ] **Step 7: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "Add Phase 2 types and fields to session store

Adds GapAnalysis, LearningPath, Gap, LearningMilestone, GapSeverity,
GapCategory types; jobAdvert input; gapAnalysis and learningPath
output fields; setJobAdvert/setGapAnalysis/setLearningPath actions;
reset() now clears all of the above. Drops pendingChatMessage —
chat auto-send and ChatCard will be cleaned up in later tasks."
```

---

## Task 2: Extract isTokenLimitError to a shared helper

**Files:**
- Create: `lib/token-limit.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/distillProfile/route.ts`

- [ ] **Step 1: Create the shared helper**

Create `lib/token-limit.ts`:

```ts
/**
 * Heuristic match for token-limit errors across LLM providers. Used to trigger
 * trim-and-retry fallbacks. Inspect the error's message for known fragments.
 */
export function isTokenLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    msg.includes('context length') ||
    msg.includes('context_length') ||
    msg.includes('maximum context') ||
    msg.includes('too many tokens') ||
    msg.includes('token limit') ||
    msg.includes('reduce the length')
  );
}
```

- [ ] **Step 2: Update chat route to import the helper**

In `app/api/chat/route.ts`:

1. Add the import at the top alongside the other lib imports:
```ts
import { isTokenLimitError } from '@/lib/token-limit';
```
2. Delete the inline `function isTokenLimitError(e: unknown): boolean { ... }` definition.

- [ ] **Step 3: Update distillProfile route**

In `app/api/distillProfile/route.ts`:

1. Add the same import.
2. Delete the inline duplicate `isTokenLimitError` function.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: same set of pre-existing errors as Task 1 (chat page + ChatCard reference dead `pendingChatMessage`). No new errors from this task.

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/token-limit.ts app/api/chat/route.ts app/api/distillProfile/route.ts
git commit -m "Extract isTokenLimitError to shared helper

Both gap analysis and learning path routes will need this same
detection logic. DRY it now before adding more callers."
```

---

## Task 3: Update careers prompt + chat context for jobAdvert

**Files:**
- Modify: `lib/prompts/careers.ts`
- Modify: `lib/prompts/careers.test.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Add a failing test for jobAdvert in careers prompt**

In `lib/prompts/careers.test.ts`, append to the `describe('buildCareersPrompt', ...)` block:

```ts
  it('includes job advert when provided', () => {
    const out = buildCareersPrompt({ jobAdvert: 'We are hiring a Data Analyst...' });
    expect(out).toContain('We are hiring a Data Analyst');
    expect(out).toContain('<jobAdvert>');
  });
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm run test -- lib/prompts/careers.test.ts`
Expected: FAIL — the new test errors because `CareersInput` doesn't accept `jobAdvert` (TypeScript error) or because the output doesn't contain `<jobAdvert>`.

- [ ] **Step 3: Update CareersInput and the prompt builder**

In `lib/prompts/careers.ts`:

1. Add `jobAdvert?: string;` to `CareersInput`:
```ts
export type CareersInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};
```

2. Update the `hasAny` check in `buildCareersPrompt` to include `jobAdvert`:
```ts
  const hasAny =
    (resume && resume.trim()) ||
    (freeText && freeText.trim()) ||
    (jobTitle && jobTitle.trim()) ||
    (jobAdvert && jobAdvert.trim()) ||
    distilledProfile;
```

3. Destructure `jobAdvert` at the top of the function:
```ts
  const { resume, freeText, jobTitle, jobAdvert, distilledProfile } = input;
```

4. Add a new section block in `buildCareersPrompt` after the `<jobTitleOfInterest>` block (or after `<resume>` if you prefer that order):
```ts
  if (jobAdvert && jobAdvert.trim()) {
    sections.push(`<jobAdvert>\n${jobAdvert.trim()}\n</jobAdvert>`);
  }
```

5. Update `buildCareerDetailPrompt` to include the advert in the context if present:
```ts
  if (input.jobAdvert) parts.push(`Job advert of interest:\n${input.jobAdvert}`);
```
(Add this line near the other `parts.push` calls in `buildCareerDetailPrompt`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/prompts/careers.test.ts`
Expected: PASS — 8 tests now (the 7 existing plus the new one).

- [ ] **Step 5: Update chat route's context block to accept jobAdvert**

In `app/api/chat/route.ts`:

1. Add `jobAdvert?: string;` to `ChatRequest`:
```ts
interface ChatRequest {
  messages: ChatMessage[];
  currentFocus: string | null;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  llmConfig?: LLMConfig;
}
```

2. Update `buildContextBlock` signature and body:
```ts
function buildContextBlock(
  resumeText?: string | null,
  freeText?: string,
  jobTitle?: string,
  jobAdvert?: string
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
  if (parts.length === 0) return null;
  return `The student has shared the following information with you. The full text is included below — you CAN read it. When the student refers to "my resume", "the resume", "my attachment", "the job", "the advert", "what I uploaded", or similar phrases, they mean this content. Refer to it by its details, not as a separate file:\n\n${parts.join('\n\n')}`;
}
```

3. Update the call to `buildContextBlock` in the route handler to pass `jobAdvert`:
```ts
    const {
      messages,
      currentFocus,
      resumeText,
      freeText,
      jobTitle,
      jobAdvert,
      llmConfig: clientConfig,
    } = (await request.json()) as ChatRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildAdvisorSystemPrompt(currentFocus);
    const contextBlock = buildContextBlock(resumeText, freeText, jobTitle, jobAdvert);
```

- [ ] **Step 6: Update the diagnostic log**

Update the `console.log('[chat] incoming:', ...)` block to include the new field:

```ts
    console.log('[chat] incoming:', {
      messageCount: messages?.length,
      currentFocus,
      resumeTextLen: resumeText ? resumeText.length : 0,
      freeTextLen: freeText ? freeText.length : 0,
      jobTitle: jobTitle || null,
      jobAdvertLen: jobAdvert ? jobAdvert.length : 0,
      contextBlockPresent: !!contextBlock,
    });
```

- [ ] **Step 7: Run tests + type-check**

Run: `npm run test`
Expected: all PASS.

Run: `npx tsc --noEmit`
Expected: same pre-existing errors only.

- [ ] **Step 8: Commit**

```bash
git add lib/prompts/careers.ts lib/prompts/careers.test.ts app/api/chat/route.ts
git commit -m "Thread jobAdvert through careers prompt and chat context

CareersInput grows a jobAdvert field; buildCareersPrompt and
buildCareerDetailPrompt include it in the prompt. Chat route's
buildContextBlock also accepts jobAdvert so the advisor can see
the posting when it's been pasted on the landing."
```

---

## Task 4: profile-text helper (TDD)

**Files:**
- Create: `lib/profile-text.ts`
- Create: `lib/profile-text.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/profile-text.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { profileToReadableText } from './profile-text';
import type { StudentProfile } from './session-store';

describe('profileToReadableText', () => {
  it('produces a paragraph from a full profile', () => {
    const p: StudentProfile = {
      background: 'A final-year business student from Perth with a marketing background',
      interests: ['data analysis', 'teaching', 'behavioural research'],
      skills: ['SQL basics', 'Excel', 'presentations'],
      constraints: ['remote work only'],
      goals: ['land a data role within 12 months'],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('A final-year business student from Perth');
    expect(out).toContain('data analysis');
    expect(out).toContain('SQL basics');
    expect(out).toContain('remote work only');
    expect(out).toContain('land a data role');
  });

  it('skips empty arrays without producing dangling sentences', () => {
    const p: StudentProfile = {
      background: 'A student',
      interests: [],
      skills: [],
      constraints: [],
      goals: [],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('A student');
    expect(out).not.toMatch(/My skills include\s*\./);
    expect(out).not.toMatch(/I'm interested in\s*\./);
  });

  it('handles a partial profile with only background and goals', () => {
    const p: StudentProfile = {
      background: 'A nursing student',
      interests: [],
      skills: [],
      constraints: [],
      goals: ['become a community health nurse'],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('A nursing student');
    expect(out).toContain('become a community health nurse');
  });

  it('joins multi-item lists with commas', () => {
    const p: StudentProfile = {
      background: 'X',
      interests: ['a', 'b', 'c'],
      skills: [],
      constraints: [],
      goals: [],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('a, b, c');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/profile-text.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement profile-text**

Create `lib/profile-text.ts`:

```ts
import type { StudentProfile } from './session-store';

/**
 * Turns a StudentProfile JSON into a single human-readable paragraph
 * suitable for pre-filling the "About you" textarea on the landing page.
 *
 * Empty arrays are skipped so we don't emit dangling sentences like
 * "My skills include ." Partial profiles render gracefully.
 */
export function profileToReadableText(p: StudentProfile): string {
  const sentences: string[] = [];

  if (p.background && p.background.trim()) {
    // Strip a trailing period so we can re-add it cleanly.
    const bg = p.background.trim().replace(/\.$/, '');
    sentences.push(`${bg}.`);
  }

  if (p.interests && p.interests.length > 0) {
    sentences.push(`I'm interested in ${p.interests.join(', ')}.`);
  }

  if (p.skills && p.skills.length > 0) {
    sentences.push(`My skills include ${p.skills.join(', ')}.`);
  }

  if (p.constraints && p.constraints.length > 0) {
    sentences.push(`Constraints: ${p.constraints.join(', ')}.`);
  }

  if (p.goals && p.goals.length > 0) {
    sentences.push(`My goal is to ${p.goals.join(', and to ')}.`);
  }

  return sentences.join(' ');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/profile-text.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/profile-text.ts lib/profile-text.test.ts
git commit -m "Add profileToReadableText helper for About-you pre-fill"
```

---

## Task 5: gaps prompt builder + parser (TDD)

**Files:**
- Create: `lib/prompts/gaps.ts`
- Create: `lib/prompts/gaps.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/prompts/gaps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGapAnalysisPrompt, parseGapAnalysis } from './gaps';
import type { GapAnalysis } from '@/lib/session-store';

describe('buildGapAnalysisPrompt', () => {
  it('throws when no target is provided', () => {
    expect(() =>
      buildGapAnalysisPrompt({ resume: 'r' })
    ).toThrow();
  });

  it('throws when no profile is provided', () => {
    expect(() =>
      buildGapAnalysisPrompt({ jobTitle: 'Data Analyst' })
    ).toThrow();
  });

  it('builds with job title + resume', () => {
    const out = buildGapAnalysisPrompt({
      jobTitle: 'Data Analyst',
      resume: 'experienced in marketing',
    });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('experienced in marketing');
    expect(out).toContain('<target>');
    expect(out).toContain('<profile>');
  });

  it('builds with job advert + about you', () => {
    const out = buildGapAnalysisPrompt({
      jobAdvert: 'We seek a curious data analyst...',
      aboutYou: 'I have a stats background',
    });
    expect(out).toContain('We seek a curious data analyst');
    expect(out).toContain('stats background');
  });

  it('includes distilled profile when provided', () => {
    const out = buildGapAnalysisPrompt({
      jobTitle: 'X',
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['data role'],
      },
    });
    expect(out).toContain('CS student');
    expect(out).toContain('python');
  });

  it('asks for the GapAnalysis JSON shape', () => {
    const out = buildGapAnalysisPrompt({ jobTitle: 'X', resume: 'y' });
    expect(out).toContain('summary');
    expect(out).toContain('matches');
    expect(out).toContain('gaps');
    expect(out).toContain('severity');
    expect(out).toContain('targetLevel');
    expect(out).toContain('evidenceIdeas');
    expect(out).toContain('realisticTimeline');
  });
});

describe('parseGapAnalysis', () => {
  const validRaw = JSON.stringify({
    target: 'Data Analyst',
    summary: 'You are well placed.',
    matches: ['SQL basics', 'Stats'],
    gaps: [
      {
        title: 'Intermediate SQL',
        category: 'technical',
        severity: 'critical',
        why: 'Required for the role',
        targetLevel: 'Joins, window functions, CTEs',
        currentLevel: 'Basic SELECT',
        evidenceIdeas: ['Portfolio project', 'Coursera course'],
      },
    ],
    realisticTimeline: '3-6 months',
  });

  it('parses a clean JSON response', () => {
    const g = parseGapAnalysis(validRaw);
    expect(g.target).toBe('Data Analyst');
    expect(g.gaps).toHaveLength(1);
    expect(g.gaps[0].severity).toBe('critical');
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + validRaw + '\n```';
    const g = parseGapAnalysis(wrapped);
    expect(g.target).toBe('Data Analyst');
  });

  it('coerces missing matches to empty array', () => {
    const raw = JSON.stringify({
      target: 'X',
      summary: 'y',
      gaps: [{
        title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    });
    const g = parseGapAnalysis(raw);
    expect(g.matches).toEqual([]);
  });

  it('allows nullable currentLevel', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', matches: [],
      gaps: [{
        title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    });
    const g = parseGapAnalysis(raw);
    expect(g.gaps[0].currentLevel).toBeNull();
  });

  it('throws when summary is missing', () => {
    const raw = JSON.stringify({
      target: 'X', matches: [],
      gaps: [{ title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', evidenceIdeas: ['e'] }],
      realisticTimeline: '3 months',
    });
    expect(() => parseGapAnalysis(raw)).toThrow();
  });

  it('throws when gaps array is empty', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', matches: [],
      gaps: [],
      realisticTimeline: '3 months',
    });
    expect(() => parseGapAnalysis(raw)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/prompts/gaps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement gaps.ts**

Create `lib/prompts/gaps.ts`:

```ts
import type { GapAnalysis, StudentProfile } from '@/lib/session-store';

export type GapAnalysisInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
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

export function buildGapAnalysisPrompt(input: GapAnalysisInput): string {
  const { jobAdvert, jobTitle, resume, aboutYou, distilledProfile } = input;

  const hasTarget = (jobAdvert && jobAdvert.trim()) || (jobTitle && jobTitle.trim());
  const hasProfile =
    (resume && resume.trim()) ||
    (aboutYou && aboutYou.trim()) ||
    distilledProfile;

  if (!hasTarget) {
    throw new Error('buildGapAnalysisPrompt: a target (jobAdvert or jobTitle) is required');
  }
  if (!hasProfile) {
    throw new Error('buildGapAnalysisPrompt: a profile (resume, aboutYou, or distilledProfile) is required');
  }

  const targetSection = jobAdvert && jobAdvert.trim()
    ? `<target type="jobAdvert">\n${jobAdvert.trim()}\n</target>`
    : `<target type="jobTitle">\n${(jobTitle || '').trim()}\n</target>`;

  const profileParts: string[] = [];
  if (resume && resume.trim()) {
    profileParts.push(`Resume:\n${resume.trim()}`);
  }
  if (aboutYou && aboutYou.trim()) {
    profileParts.push(`About me:\n${aboutYou.trim()}`);
  }
  if (distilledProfile) {
    profileParts.push(`Distilled profile:\n${formatProfile(distilledProfile)}`);
  }
  const profileSection = `<profile>\n${profileParts.join('\n\n')}\n</profile>`;

  return [
    `Read the target role and the student's profile below. Identify specific gaps the student needs to close to be a strong candidate. Be honest but encouraging — always call out what the student already has. Never fabricate specific course names, URLs, certifications, or pricing. Describe the type of evidence that would close each gap, not named products. If the profile is thin, say so in the summary.`,
    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "target": string — short label for the role being analysed (e.g., "Data Analyst" or a 5-10 word summary of the advert),
  "summary": string — 2-3 sentence plain-English overview of how the student is positioned for this role,
  "matches": string[] — what the student already has that fits this role (morale boost — always include something if possible),
  "gaps": Gap[] — at least 1, ordered by severity (critical first),
  "realisticTimeline": string — e.g., "3-6 months with focused effort"
}

Each Gap has the shape:
{
  "title": string,
  "category": "technical" | "experience" | "qualification" | "soft" | "domain",
  "severity": "critical" | "important" | "nice-to-have",
  "why": string — 1-2 sentences explaining why this matters for this target,
  "targetLevel": string — what the role expects,
  "currentLevel": string | null — what the student appears to have now (null if unclear),
  "evidenceIdeas": string[] — concrete (but not branded) ways to demonstrate this skill
}`,
    targetSection,
    profileSection,
    'ONLY respond with JSON. No prose, no code fences.',
  ].join('\n\n');
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

const VALID_CATEGORIES = new Set(['technical', 'experience', 'qualification', 'soft', 'domain']);
const VALID_SEVERITIES = new Set(['critical', 'important', 'nice-to-have']);

export function parseGapAnalysis(raw: string): GapAnalysis {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseGapAnalysis: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseGapAnalysis: missing summary');
  }
  if (!Array.isArray(parsed.gaps) || parsed.gaps.length === 0) {
    throw new Error('parseGapAnalysis: gaps must be a non-empty array');
  }

  const gaps = parsed.gaps.map((g: any, idx: number) => {
    if (typeof g.title !== 'string' || !g.title.trim()) {
      throw new Error(`parseGapAnalysis: gap ${idx} missing title`);
    }
    const category = VALID_CATEGORIES.has(g.category) ? g.category : 'technical';
    const severity = VALID_SEVERITIES.has(g.severity) ? g.severity : 'important';
    return {
      title: g.title,
      category,
      severity,
      why: typeof g.why === 'string' ? g.why : '',
      targetLevel: typeof g.targetLevel === 'string' ? g.targetLevel : '',
      currentLevel: typeof g.currentLevel === 'string' ? g.currentLevel : null,
      evidenceIdeas: toStringArray(g.evidenceIdeas),
    };
  });

  return {
    target: typeof parsed.target === 'string' && parsed.target.trim() ? parsed.target : 'this role',
    summary: parsed.summary,
    matches: toStringArray(parsed.matches),
    gaps,
    realisticTimeline: typeof parsed.realisticTimeline === 'string'
      ? parsed.realisticTimeline
      : 'Hard to say — depends on your situation',
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/prompts/gaps.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Run full suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/prompts/gaps.ts lib/prompts/gaps.test.ts
git commit -m "Add gap analysis prompt builder and parser"
```

---

## Task 6: learningPath prompt builder + parser (TDD)

**Files:**
- Create: `lib/prompts/learningPath.ts`
- Create: `lib/prompts/learningPath.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/prompts/learningPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildLearningPathPrompt, parseLearningPath } from './learningPath';
import type { GapAnalysis } from '@/lib/session-store';

describe('buildLearningPathPrompt', () => {
  it('throws when no target is provided', () => {
    expect(() => buildLearningPathPrompt({})).toThrow();
  });

  it('builds with just a job title (standalone)', () => {
    const out = buildLearningPathPrompt({ jobTitle: 'Data Analyst' });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('<target');
  });

  it('builds with a job advert', () => {
    const out = buildLearningPathPrompt({ jobAdvert: 'We need a designer who...' });
    expect(out).toContain('We need a designer');
  });

  it('includes profile when provided', () => {
    const out = buildLearningPathPrompt({
      jobTitle: 'X',
      resume: 'experienced',
      aboutYou: 'I want to switch fields',
    });
    expect(out).toContain('experienced');
    expect(out).toContain('switch fields');
  });

  it('mentions gap chain seed when provided', () => {
    const gap: GapAnalysis = {
      target: 'Data Analyst',
      summary: 's',
      matches: [],
      gaps: [{
        title: 'SQL', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', currentLevel: null, evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    };
    const out = buildLearningPathPrompt({ jobTitle: 'X', gapAnalysis: gap });
    expect(out).toContain('SQL');
    expect(out).toMatch(/prioriti[sz]e/i);
  });

  it('asks for the LearningPath JSON shape', () => {
    const out = buildLearningPathPrompt({ jobTitle: 'X' });
    expect(out).toContain('milestones');
    expect(out).toContain('weekRange');
    expect(out).toContain('activities');
    expect(out).toContain('outcome');
    expect(out).toContain('portfolioProject');
    expect(out).toContain('totalDuration');
    expect(out).toContain('caveats');
  });
});

describe('parseLearningPath', () => {
  const validRaw = JSON.stringify({
    target: 'Data Analyst',
    summary: 'A 12-week path.',
    prerequisites: ['Basic computer literacy'],
    milestones: [
      {
        weekRange: 'Weeks 1-2',
        focus: 'Python basics',
        activities: ['Complete a course', 'Build a small script'],
        outcome: 'Comfortable with Python syntax',
      },
    ],
    portfolioProject: 'Build a dashboard',
    totalDuration: '12 weeks',
    caveats: ['AI-generated suggestions'],
  });

  it('parses a clean JSON response', () => {
    const p = parseLearningPath(validRaw);
    expect(p.target).toBe('Data Analyst');
    expect(p.milestones).toHaveLength(1);
    expect(p.milestones[0].activities).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + validRaw + '\n```';
    const p = parseLearningPath(wrapped);
    expect(p.target).toBe('Data Analyst');
  });

  it('coerces missing optional fields to defaults', () => {
    const raw = JSON.stringify({
      target: 'X',
      summary: 'y',
      milestones: [{
        weekRange: 'W1', focus: 'f', activities: ['a'], outcome: 'o',
      }],
      totalDuration: '4 weeks',
    });
    const p = parseLearningPath(raw);
    expect(p.prerequisites).toEqual([]);
    expect(p.caveats).toEqual([]);
    expect(p.portfolioProject).toBe('');
  });

  it('throws when milestones is missing', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', totalDuration: '4 weeks',
    });
    expect(() => parseLearningPath(raw)).toThrow();
  });

  it('throws when milestones is empty', () => {
    const raw = JSON.stringify({
      target: 'X', summary: 'y', milestones: [], totalDuration: '4 weeks',
    });
    expect(() => parseLearningPath(raw)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/prompts/learningPath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement learningPath.ts**

Create `lib/prompts/learningPath.ts`:

```ts
import type { GapAnalysis, LearningPath, StudentProfile } from '@/lib/session-store';

export type LearningPathInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  gapAnalysis?: GapAnalysis;
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

function formatGapsForPrompt(g: GapAnalysis): string {
  const lines = g.gaps.map((gap, i) =>
    `${i + 1}. [${gap.severity.toUpperCase()}] ${gap.title} — ${gap.why}`
  );
  return `Existing gap analysis for this target:\n${g.summary}\n\nGaps to close:\n${lines.join('\n')}`;
}

export function buildLearningPathPrompt(input: LearningPathInput): string {
  const { jobAdvert, jobTitle, resume, aboutYou, distilledProfile, gapAnalysis } = input;

  const hasTarget = (jobAdvert && jobAdvert.trim()) || (jobTitle && jobTitle.trim());
  if (!hasTarget) {
    throw new Error('buildLearningPathPrompt: a target (jobAdvert or jobTitle) is required');
  }

  const targetSection = jobAdvert && jobAdvert.trim()
    ? `<target type="jobAdvert">\n${jobAdvert.trim()}\n</target>`
    : `<target type="jobTitle">\n${(jobTitle || '').trim()}\n</target>`;

  const sections: string[] = [];

  sections.push(
    `You are a career learning-path designer. Given a target role (and optionally a student profile and gap list), produce a structured week-by-week learning path. Milestones must be concrete and actionable. Be honest about AI limits — never fabricate specific course URLs, certification names, or pricing. Suggest the type of resource ("an intermediate SQL course on a major platform") not a specific one unless it is widely known (e.g., "Google Data Analytics Certificate"). Always include caveats.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "target": string — the role name,
  "summary": string — 2-3 sentence overview of the path,
  "prerequisites": string[] — what the student should already have or confirm before starting,
  "milestones": Milestone[] — at least 1, ordered chronologically,
  "portfolioProject": string — one suggested capstone project that ties the milestones together,
  "totalDuration": string — e.g., "12 weeks" or "3-6 months part-time",
  "caveats": string[] — honest notes about AI limits, time assumptions, etc.
}

Each Milestone has the shape:
{
  "weekRange": string — e.g., "Weeks 1-2",
  "focus": string — short label for the milestone,
  "activities": string[] — concrete things to do,
  "outcome": string — what the student should be able to do by the end
}`
  );

  sections.push(targetSection);

  if (resume || aboutYou || distilledProfile) {
    const profileParts: string[] = [];
    if (resume && resume.trim()) {
      profileParts.push(`Resume:\n${resume.trim()}`);
    }
    if (aboutYou && aboutYou.trim()) {
      profileParts.push(`About me:\n${aboutYou.trim()}`);
    }
    if (distilledProfile) {
      profileParts.push(`Distilled profile:\n${formatProfile(distilledProfile)}`);
    }
    sections.push(`<profile>\n${profileParts.join('\n\n')}\n</profile>`);
  }

  if (gapAnalysis) {
    sections.push(
      `<gapAnalysis>\n${formatGapsForPrompt(gapAnalysis)}\n</gapAnalysis>\n\nPrioritise the listed gaps in the earliest milestones.`
    );
  }

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

export function parseLearningPath(raw: string): LearningPath {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseLearningPath: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseLearningPath: missing summary');
  }
  if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
    throw new Error('parseLearningPath: milestones must be a non-empty array');
  }
  if (typeof parsed.totalDuration !== 'string' || !parsed.totalDuration.trim()) {
    throw new Error('parseLearningPath: missing totalDuration');
  }

  const milestones = parsed.milestones.map((m: any, idx: number) => {
    if (typeof m.weekRange !== 'string' || !m.weekRange.trim()) {
      throw new Error(`parseLearningPath: milestone ${idx} missing weekRange`);
    }
    if (typeof m.focus !== 'string' || !m.focus.trim()) {
      throw new Error(`parseLearningPath: milestone ${idx} missing focus`);
    }
    return {
      weekRange: m.weekRange,
      focus: m.focus,
      activities: toStringArray(m.activities),
      outcome: typeof m.outcome === 'string' ? m.outcome : '',
    };
  });

  return {
    target: typeof parsed.target === 'string' && parsed.target.trim() ? parsed.target : 'this role',
    summary: parsed.summary,
    prerequisites: toStringArray(parsed.prerequisites),
    milestones,
    portfolioProject: typeof parsed.portfolioProject === 'string' ? parsed.portfolioProject : '',
    totalDuration: parsed.totalDuration,
    caveats: toStringArray(parsed.caveats),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/prompts/learningPath.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Run full suite**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/prompts/learningPath.ts lib/prompts/learningPath.test.ts
git commit -m "Add learning path prompt builder and parser"
```

---

## Task 7: markdown-export helpers (TDD)

**Files:**
- Create: `lib/markdown-export.ts`
- Create: `lib/markdown-export.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/markdown-export.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/markdown-export.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement markdown-export.ts**

Create `lib/markdown-export.ts`:

```ts
import type { GapAnalysis, LearningPath } from './session-store';

export function gapAnalysisToMarkdown(g: GapAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Gap Analysis: ${g.target}`);
  lines.push('');
  lines.push(g.summary);
  lines.push('');

  if (g.matches.length > 0) {
    lines.push('## What you already have');
    for (const m of g.matches) {
      lines.push(`- ${m}`);
    }
    lines.push('');
  }

  lines.push('## Gaps');
  lines.push('');
  for (const gap of g.gaps) {
    lines.push(`### [${gap.severity.toUpperCase()}] ${gap.title}`);
    if (gap.why) lines.push(`**Why it matters:** ${gap.why}`);
    if (gap.targetLevel) lines.push(`**Target level:** ${gap.targetLevel}`);
    if (gap.currentLevel) lines.push(`**Current level:** ${gap.currentLevel}`);
    if (gap.evidenceIdeas.length > 0) {
      lines.push('**How to demonstrate:**');
      for (const e of gap.evidenceIdeas) {
        lines.push(`- ${e}`);
      }
    }
    lines.push('');
  }

  lines.push('## Rough timeline');
  lines.push(g.realisticTimeline);
  lines.push('');
  lines.push('*AI-generated. Verify suggestions against your own situation.*');

  return lines.join('\n');
}

export function learningPathToMarkdown(p: LearningPath): string {
  const lines: string[] = [];

  lines.push(`# Learning Path: ${p.target}`);
  lines.push('');
  lines.push(p.summary);
  lines.push('');
  lines.push(`**Total duration:** ${p.totalDuration}`);
  lines.push('');

  if (p.prerequisites.length > 0) {
    lines.push('## Before you start');
    for (const pre of p.prerequisites) {
      lines.push(`- ${pre}`);
    }
    lines.push('');
  }

  lines.push('## Milestones');
  lines.push('');
  for (const m of p.milestones) {
    lines.push(`### ${m.weekRange} · ${m.focus}`);
    if (m.activities.length > 0) {
      lines.push('**Activities:**');
      for (const a of m.activities) {
        lines.push(`- ${a}`);
      }
    }
    if (m.outcome) {
      lines.push('');
      lines.push(`**Outcome:** ${m.outcome}`);
    }
    lines.push('');
  }

  if (p.portfolioProject) {
    lines.push('## Portfolio project');
    lines.push(p.portfolioProject);
    lines.push('');
  }

  if (p.caveats.length > 0) {
    lines.push('## Caveats');
    for (const c of p.caveats) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  lines.push('*AI-generated. Treat specific course names as starting points, not final recommendations.*');

  return lines.join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/markdown-export.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "Add markdown export helpers for gap and learning path"
```

---

## Task 8: /api/gapAnalysis route

**Files:**
- Create: `app/api/gapAnalysis/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildGapAnalysisPrompt, parseGapAnalysis, type GapAnalysisInput } from '@/lib/prompts/gaps';
import { isTokenLimitError } from '@/lib/token-limit';

interface GapAnalysisRequest extends GapAnalysisInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;

function trimInput(input: GapAnalysisInput): GapAnalysisInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as GapAnalysisRequest;

    // Defence-in-depth: landing checks first, but guard direct callers.
    const hasTarget = !!((input.jobAdvert && input.jobAdvert.trim()) || (input.jobTitle && input.jobTitle.trim()));
    const hasProfile = !!((input.resume && input.resume.trim()) || (input.aboutYou && input.aboutYou.trim()) || input.distilledProfile);
    if (!hasTarget) {
      return new Response(
        JSON.stringify({ error: 'A target is required (paste a job advert or enter a job title).' }),
        { status: 400 }
      );
    }
    if (!hasProfile) {
      return new Response(
        JSON.stringify({ error: 'A profile is required (upload a resume or write something in About you).' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[gapAnalysis] incoming:', {
      hasJobAdvert: !!input.jobAdvert,
      hasJobTitle: !!input.jobTitle,
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career gap analyst that ONLY responds in JSON.' },
          { role: 'user', content: buildGapAnalysisPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimInput(input);
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career gap analyst that ONLY responds in JSON.' },
          { role: 'user', content: buildGapAnalysisPrompt(shorter) },
        ],
        llmConfig
      );
    }

    const analysis = parseGapAnalysis(raw);
    return new Response(JSON.stringify({ analysis, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[gapAnalysis] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing errors only (chat page + ChatCard `pendingChatMessage`).

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/gapAnalysis/route.ts
git commit -m "Add /api/gapAnalysis route with trim fallback"
```

---

## Task 9: /api/learningPath route

**Files:**
- Create: `app/api/learningPath/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildLearningPathPrompt, parseLearningPath, type LearningPathInput } from '@/lib/prompts/learningPath';
import { isTokenLimitError } from '@/lib/token-limit';

interface LearningPathRequest extends LearningPathInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;

function trimInput(input: LearningPathInput): LearningPathInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as LearningPathRequest;

    const hasTarget = !!((input.jobAdvert && input.jobAdvert.trim()) || (input.jobTitle && input.jobTitle.trim()));
    if (!hasTarget) {
      return new Response(
        JSON.stringify({ error: 'A target is required (paste a job advert or enter a job title).' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[learningPath] incoming:', {
      hasJobAdvert: !!input.jobAdvert,
      hasJobTitle: !!input.jobTitle,
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
      hasGapAnalysis: !!input.gapAnalysis,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career learning-path designer that ONLY responds in JSON.' },
          { role: 'user', content: buildLearningPathPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimInput(input);
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career learning-path designer that ONLY responds in JSON.' },
          { role: 'user', content: buildLearningPathPrompt(shorter) },
        ],
        llmConfig
      );
    }

    const path = parseLearningPath(raw);
    return new Response(JSON.stringify({ path, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[learningPath] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check + tests**

Run: `npx tsc --noEmit` and `npm run test`
Expected: same pre-existing errors; tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/learningPath/route.ts
git commit -m "Add /api/learningPath route with trim fallback"
```

---

## Task 10: CopyMarkdownButton component

**Files:**
- Create: `components/results/CopyMarkdownButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

type Props = {
  getMarkdown: () => string;
  label?: string;
};

export default function CopyMarkdownButton({ getMarkdown, label = 'Copy as Markdown' }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getMarkdown());
      setCopied(true);
      toast.success('Copied.');
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Could not copy. Your browser may not allow clipboard access.');
    }
  }

  return (
    <Button variant='outline' onClick={handleCopy}>
      {copied ? <Check className='w-4 h-4 mr-2' /> : <Clipboard className='w-4 h-4 mr-2' />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing errors only.

- [ ] **Step 3: Commit**

```bash
git add components/results/CopyMarkdownButton.tsx
git commit -m "Add shared CopyMarkdownButton component"
```

---

## Task 11: GapItem component

**Files:**
- Create: `components/results/GapItem.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Gap } from '@/lib/session-store';

type Props = {
  gap: Gap;
  expanded: boolean;
  onToggle: () => void;
};

const SEVERITY_LABEL: Record<Gap['severity'], string> = {
  'critical': 'CRITICAL',
  'important': 'IMPORTANT',
  'nice-to-have': 'NICE-TO-HAVE',
};

const SEVERITY_COLOR: Record<Gap['severity'], string> = {
  'critical': 'text-error',
  'important': 'text-accent',
  'nice-to-have': 'text-ink-muted',
};

export default function GapItem({ gap, expanded, onToggle }: Props) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div className='border border-border rounded-lg bg-paper'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent-soft transition-colors duration-[250ms]'
        aria-expanded={expanded}
      >
        <Chevron className='w-4 h-4 text-ink-quiet flex-shrink-0' />
        <span className={`text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] ${SEVERITY_COLOR[gap.severity]} flex-shrink-0`}>
          [{SEVERITY_LABEL[gap.severity]}]
        </span>
        <span className='text-ink font-medium flex-1'>{gap.title}</span>
      </button>
      {expanded && (
        <div className='border-t border-border px-4 py-4 space-y-3'>
          {gap.why && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Why it matters
              </div>
              <p className='text-ink-muted leading-relaxed'>{gap.why}</p>
            </div>
          )}
          {gap.targetLevel && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Target level
              </div>
              <p className='text-ink-muted leading-relaxed'>{gap.targetLevel}</p>
            </div>
          )}
          {gap.currentLevel && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Current level
              </div>
              <p className='text-ink-muted leading-relaxed'>{gap.currentLevel}</p>
            </div>
          )}
          {gap.evidenceIdeas.length > 0 && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                How to demonstrate
              </div>
              <ul className='list-disc ml-5 text-ink-muted leading-relaxed space-y-1'>
                {gap.evidenceIdeas.map((idea, i) => (
                  <li key={i}>{idea}</li>
                ))}
              </ul>
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

```bash
git add components/results/GapItem.tsx
git commit -m "Add collapsible GapItem component"
```

---

## Task 12: GapAnalysisView component

**Files:**
- Create: `components/results/GapAnalysisView.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { GapAnalysis, LearningPath } from '@/lib/session-store';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import { gapAnalysisToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig } from '@/lib/llm-client';
import CopyMarkdownButton from './CopyMarkdownButton';
import GapItem from './GapItem';

type Props = { analysis: GapAnalysis };

export default function GapAnalysisView({ analysis }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [chaining, setChaining] = useState(false);

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    analysis.gaps.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded = analysis.gaps.every((_, i) => expanded[i]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  async function handleChainToLearningPath() {
    setChaining(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/learningPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          gapAnalysis: analysis,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Learning path failed');
      }
      const { path } = (await res.json()) as { path: LearningPath };
      store.setLearningPath(path);
      router.push('/learning-path');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate learning path');
    } finally {
      setChaining(false);
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-6 py-8 space-y-8'>
      <div className='flex items-center gap-3'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline'>
          ← Back
        </Link>
        <div className='flex-1' />
        <CopyMarkdownButton getMarkdown={() => gapAnalysisToMarkdown(analysis)} />
        <Button variant='outline' onClick={handleStartOver}>Start over</Button>
      </div>

      <div>
        <div className='editorial-rule'>
          <span>Gap Analysis</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          vs {analysis.target}
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{analysis.summary}</p>
      </div>

      {analysis.matches.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>What you already have</h2>
          <ul className='space-y-1'>
            {analysis.matches.map((m, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>✓</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>Gaps</h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Hide all details' : 'Show all details'}
          </button>
        </div>
        <div className='space-y-2'>
          {analysis.gaps.map((g, i) => (
            <GapItem key={i} gap={g} expanded={!!expanded[i]} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>

      <div className='border-t border-border pt-6'>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Rough timeline
        </div>
        <p className='text-ink'>{analysis.realisticTimeline}</p>
        <p className='text-[var(--text-xs)] text-ink-quiet mt-1'>
          AI estimate. Verify against your own situation.
        </p>
      </div>

      <div className='flex justify-end'>
        <Button onClick={handleChainToLearningPath} disabled={chaining}>
          {chaining ? 'Building…' : 'Turn this into a learning path →'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add components/results/GapAnalysisView.tsx
git commit -m "Add GapAnalysisView with collapsible details and chain to learning path"
```

---

## Task 13: /gap-analysis page

**Files:**
- Create: `app/gap-analysis/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import GapAnalysisView from '@/components/results/GapAnalysisView';

export default function GapAnalysisPage() {
  const analysis = useSessionStore((s) => s.gapAnalysis);

  if (!analysis) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4 p-10'>
        <p className='text-ink-muted'>No analysis yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <GapAnalysisView analysis={analysis} />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add app/gap-analysis/page.tsx
git commit -m "Add /gap-analysis page reading from session store"
```

---

## Task 14: MilestoneItem component

**Files:**
- Create: `components/results/MilestoneItem.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LearningMilestone } from '@/lib/session-store';

type Props = {
  milestone: LearningMilestone;
  expanded: boolean;
  onToggle: () => void;
};

export default function MilestoneItem({ milestone, expanded, onToggle }: Props) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div className='border border-border rounded-lg bg-paper'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent-soft transition-colors duration-[250ms]'
        aria-expanded={expanded}
      >
        <Chevron className='w-4 h-4 text-ink-quiet flex-shrink-0' />
        <span className='text-ink-quiet font-medium flex-shrink-0'>{milestone.weekRange}</span>
        <span className='text-ink-quiet'>·</span>
        <span className='text-ink font-medium flex-1'>{milestone.focus}</span>
      </button>
      {expanded && (
        <div className='border-t border-border px-4 py-4 space-y-3'>
          {milestone.activities.length > 0 && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Activities
              </div>
              <ul className='list-disc ml-5 text-ink-muted leading-relaxed space-y-1'>
                {milestone.activities.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {milestone.outcome && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Outcome
              </div>
              <p className='text-ink-muted leading-relaxed'>{milestone.outcome}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/results/MilestoneItem.tsx
git commit -m "Add collapsible MilestoneItem component"
```

---

## Task 15: LearningPathView component

**Files:**
- Create: `components/results/LearningPathView.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import type { LearningPath, GapAnalysis } from '@/lib/session-store';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import { learningPathToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig } from '@/lib/llm-client';
import CopyMarkdownButton from './CopyMarkdownButton';
import MilestoneItem from './MilestoneItem';

type Props = { path: LearningPath };

export default function LearningPathView({ path }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [chaining, setChaining] = useState(false);

  const hasProfile = !!(store.resumeText || store.freeText.trim() || store.distilledProfile);

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    path.milestones.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded = path.milestones.every((_, i) => expanded[i]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  async function handleChainToGapAnalysis() {
    setChaining(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/gapAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gap analysis failed');
      }
      const { analysis } = (await res.json()) as { analysis: GapAnalysis };
      store.setGapAnalysis(analysis);
      router.push('/gap-analysis');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to run gap analysis');
    } finally {
      setChaining(false);
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-6 py-8 space-y-8'>
      <div className='flex items-center gap-3'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline'>
          ← Back
        </Link>
        <div className='flex-1' />
        <CopyMarkdownButton getMarkdown={() => learningPathToMarkdown(path)} />
        <Button variant='outline' onClick={handleStartOver}>Start over</Button>
      </div>

      <div>
        <div className='editorial-rule'>
          <span>Learning Path</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          to {path.target}
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{path.summary}</p>
      </div>

      <div>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Total duration
        </div>
        <p className='text-ink mb-3'>{path.totalDuration}</p>
        {path.caveats.length > 0 && (
          <div>
            <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Caveats
            </div>
            <ul className='list-disc ml-5 text-ink-muted text-[var(--text-sm)] space-y-1'>
              {path.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {path.prerequisites.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Before you start</h2>
          <ul className='space-y-1'>
            {path.prerequisites.map((p, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>Milestones</h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Hide all details' : 'Show all details'}
          </button>
        </div>
        <div className='space-y-2'>
          {path.milestones.map((m, i) => (
            <MilestoneItem key={i} milestone={m} expanded={!!expanded[i]} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>

      {path.portfolioProject && (
        <div className='border border-accent/30 bg-accent-soft rounded-lg p-5'>
          <div className='flex items-center gap-2 mb-2'>
            <FolderOpen className='w-4 h-4 text-accent' />
            <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet'>
              Portfolio project
            </span>
          </div>
          <p className='text-ink leading-relaxed'>{path.portfolioProject}</p>
        </div>
      )}

      {hasProfile && (
        <div className='flex justify-end'>
          <Button variant='outline' onClick={handleChainToGapAnalysis} disabled={chaining}>
            {chaining ? 'Analysing…' : 'Run gap analysis for this target →'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add components/results/LearningPathView.tsx
git commit -m "Add LearningPathView with collapsible milestones and reverse chain"
```

---

## Task 16: /learning-path page

**Files:**
- Create: `app/learning-path/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import LearningPathView from '@/components/results/LearningPathView';

export default function LearningPathPage() {
  const path = useSessionStore((s) => s.learningPath);

  if (!path) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4 p-10'>
        <p className='text-ink-muted'>No learning path yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <LearningPathView path={path} />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add app/learning-path/page.tsx
git commit -m "Add /learning-path page reading from session store"
```

---

## Task 17: InputsZone component (with About-you pre-fill)

**Files:**
- Create: `components/landing/InputsZone.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LocalFileUpload from '@/components/LocalFileUpload';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSessionStore } from '@/lib/session-store';
import { fileToArrayBuffer } from '@/lib/utils';
import { profileToReadableText } from '@/lib/profile-text';

export type MissingHints = {
  resume: boolean;
  jobTitle: boolean;
  aboutYou: boolean;
  jobAdvert: boolean;
  message: string | null;
};

const NO_HINTS: MissingHints = {
  resume: false,
  jobTitle: false,
  aboutYou: false,
  jobAdvert: false,
  message: null,
};

type Props = {
  missingHints: MissingHints;
  onClearHints: () => void;
};

export default function InputsZone({ missingHints, onClearHints }: Props) {
  const store = useSessionStore();
  const [aboutYouEdited, setAboutYouEdited] = useState(false);
  const prefilledRef = useRef(false);

  // One-time pre-fill of "About you" from a distilled profile, only if the
  // textarea is currently empty. Never overwrites student input.
  useEffect(() => {
    if (prefilledRef.current) return;
    const state = useSessionStore.getState();
    if (state.distilledProfile && state.freeText.trim() === '') {
      const text = profileToReadableText(state.distilledProfile);
      if (text.trim()) {
        store.setFreeText(text);
        prefilledRef.current = true;
      }
    } else {
      prefilledRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPrefillHint =
    !aboutYouEdited &&
    prefilledRef.current &&
    !!store.distilledProfile &&
    store.freeText.trim() !== '';

  async function handleResumeSelect(file: File) {
    try {
      const ab = await fileToArrayBuffer(file);
      const res = await fetch('/api/parsePdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: Array.from(new Uint8Array(ab)),
          filename: file.name,
        }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const text = await res.json();
      store.setResume(text, file.name);
      onClearHints();
    } catch (err) {
      console.error(err);
      toast.error('Could not parse that file.');
    }
  }

  function fieldClass(highlighted: boolean): string {
    return highlighted
      ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper rounded-lg'
      : '';
  }

  return (
    <div className='w-full max-w-5xl space-y-4'>
      {missingHints.message && (
        <div className='border border-accent/30 bg-accent-soft text-ink rounded-lg px-4 py-3 text-[var(--text-sm)]'>
          {missingHints.message}
        </div>
      )}

      <div className='grid md:grid-cols-2 gap-4'>
        <div className={fieldClass(missingHints.resume)}>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Resume
          </label>
          <LocalFileUpload onFileSelect={handleResumeSelect} />
          {store.resumeFilename && (
            <p className='text-[var(--text-xs)] text-ink-muted mt-1'>
              Selected: {store.resumeFilename}
            </p>
          )}
        </div>

        <div className={fieldClass(missingHints.jobTitle)}>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Job title
          </label>
          <Input
            placeholder='e.g., Data Analyst'
            value={store.jobTitle}
            onChange={(e) => {
              store.setJobTitle(e.target.value);
              if (e.target.value.trim()) onClearHints();
            }}
          />
        </div>

        <div className={fieldClass(missingHints.aboutYou)}>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            About you
          </label>
          {showPrefillHint && (
            <p className='text-[var(--text-xs)] text-ink-quiet mb-1 italic'>
              Pre-filled from your advisor chat. Edit freely.
            </p>
          )}
          <Textarea
            rows={4}
            placeholder='A few words about your background, interests, and goals.'
            value={store.freeText}
            onChange={(e) => {
              store.setFreeText(e.target.value);
              setAboutYouEdited(true);
              if (e.target.value.trim()) onClearHints();
            }}
          />
        </div>

        <div className={fieldClass(missingHints.jobAdvert)}>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Job advert
          </label>
          <Textarea
            rows={6}
            placeholder='Paste a job posting you want to analyse or work toward.'
            value={store.jobAdvert}
            onChange={(e) => {
              store.setJobAdvert(e.target.value);
              if (e.target.value.trim()) onClearHints();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export { NO_HINTS };
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same pre-existing errors only (chat page + ChatCard `pendingChatMessage`).

- [ ] **Step 3: Commit**

```bash
git add components/landing/InputsZone.tsx
git commit -m "Add InputsZone with about-you pre-fill and missing-hint highlights"
```

---

## Task 18: ActionsZone component

**Files:**
- Create: `components/landing/ActionsZone.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Compass, MessageCircle, SearchCheck, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore, type GapAnalysis, type LearningPath } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import type { MissingHints } from './InputsZone';

type Props = {
  setMissingHints: (h: MissingHints) => void;
  clearMissingHints: () => void;
};

type ActionId = 'careers' | 'chat' | 'gaps' | 'learn';

export default function ActionsZone({ setMissingHints, clearMissingHints }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState<ActionId | null>(null);

  function focusFirstHint(field: 'resume' | 'jobTitle' | 'aboutYou' | 'jobAdvert') {
    // Try to scroll the matching textarea/input into view. We rely on
    // labels written by InputsZone — selecting by attribute is brittle,
    // so we just scroll the inputs zone into view and let the user see
    // the highlighted field.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return false;
    }
    return true;
  }

  async function handleFindCareers() {
    clearMissingHints();
    const has =
      !!store.resumeText ||
      !!store.jobTitle.trim() ||
      !!store.freeText.trim() ||
      !!store.jobAdvert.trim();
    if (!has) {
      setMissingHints({
        resume: true,
        jobTitle: true,
        aboutYou: true,
        jobAdvert: true,
        message: 'To find careers, fill at least one input above.',
      });
      focusFirstHint('jobTitle');
      return;
    }
    if (!(await ensureProvider())) return;
    store.setCareers(null);
    router.push('/careers');
  }

  async function handleStartChatting() {
    clearMissingHints();
    if (!(await ensureProvider())) return;
    router.push('/chat');
  }

  async function handleGapAnalysis() {
    clearMissingHints();
    const hasTarget = !!store.jobAdvert.trim() || !!store.jobTitle.trim();
    const hasProfile = !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;
    if (!hasTarget && !hasProfile) {
      setMissingHints({
        resume: true,
        jobTitle: true,
        aboutYou: true,
        jobAdvert: true,
        message: 'Gap analysis needs a target (job title or job advert) and a profile (resume or about you).',
      });
      focusFirstHint('jobTitle');
      return;
    }
    if (!hasTarget) {
      setMissingHints({
        ...{ resume: false, jobTitle: true, aboutYou: false, jobAdvert: true },
        message: 'Gap analysis needs a job. Paste a job advert or enter a job title.',
      });
      focusFirstHint('jobTitle');
      return;
    }
    if (!hasProfile) {
      setMissingHints({
        ...{ resume: true, jobTitle: false, aboutYou: true, jobAdvert: false },
        message: 'Gap analysis needs a profile. Upload a resume or write something in About you.',
      });
      focusFirstHint('aboutYou');
      return;
    }
    if (!(await ensureProvider())) return;

    setRunning('gaps');
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/gapAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gap analysis failed');
      }
      const { analysis } = (await res.json()) as { analysis: GapAnalysis };
      store.setGapAnalysis(analysis);
      router.push('/gap-analysis');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
    } finally {
      setRunning(null);
    }
  }

  async function handleLearningPath() {
    clearMissingHints();
    const hasTarget = !!store.jobAdvert.trim() || !!store.jobTitle.trim();
    if (!hasTarget) {
      setMissingHints({
        resume: false,
        jobTitle: true,
        aboutYou: false,
        jobAdvert: true,
        message: 'Learning path needs a job. Paste a job advert or enter a job title.',
      });
      focusFirstHint('jobTitle');
      return;
    }
    if (!(await ensureProvider())) return;

    setRunning('learn');
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/learningPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Learning path failed');
      }
      const { path } = (await res.json()) as { path: LearningPath };
      store.setLearningPath(path);
      router.push('/learning-path');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Learning path failed');
    } finally {
      setRunning(null);
    }
  }

  const anyRunning = running !== null;

  return (
    <div className='w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-3 mt-6'>
      <Button onClick={handleFindCareers} disabled={anyRunning} className='py-6'>
        <Compass className='w-4 h-4 mr-2' />
        Find my careers
      </Button>
      <Button onClick={handleStartChatting} disabled={anyRunning} variant='outline' className='py-6'>
        <MessageCircle className='w-4 h-4 mr-2' />
        Start chatting
      </Button>
      <Button onClick={handleGapAnalysis} disabled={anyRunning} variant='outline' className='py-6'>
        <SearchCheck className='w-4 h-4 mr-2' />
        {running === 'gaps' ? 'Analysing…' : 'Gap analysis'}
      </Button>
      <Button onClick={handleLearningPath} disabled={anyRunning} variant='outline' className='py-6'>
        <RouteIcon className='w-4 h-4 mr-2' />
        {running === 'learn' ? 'Building…' : 'Learning path'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`

```bash
git add components/landing/ActionsZone.tsx
git commit -m "Add ActionsZone with inline missing-input prompting and run state"
```

---

## Task 19: OutputsBanner component

**Files:**
- Create: `components/landing/OutputsBanner.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';

export default function OutputsBanner() {
  const store = useSessionStore();
  const {
    chatMessages,
    careers,
    gapAnalysis,
    learningPath,
  } = store;

  const userMessageCount = chatMessages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const hasCareers = !!(careers && careers.length > 0);
  const hasChat = userMessageCount > 0;
  const hasGap = !!gapAnalysis;
  const hasPath = !!learningPath;

  if (!hasCareers && !hasChat && !hasGap && !hasPath) return null;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
  }

  return (
    <div className='w-full max-w-3xl mx-auto mb-6 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4 flex-wrap'>
      <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />
      <div className='flex-1 text-[var(--text-sm)] text-ink flex flex-wrap gap-x-3 gap-y-1 items-center'>
        <span className='text-ink-quiet'>You have:</span>
        {hasCareers && (
          <Link href='/careers' className='underline hover:text-accent'>
            {careers!.length} careers
          </Link>
        )}
        {hasChat && (
          <Link href='/chat' className='underline hover:text-accent'>
            {userMessageCount} chat message{userMessageCount === 1 ? '' : 's'}
          </Link>
        )}
        {hasGap && (
          <Link href='/gap-analysis' className='underline hover:text-accent'>
            gap analysis ready
          </Link>
        )}
        {hasPath && (
          <Link href='/learning-path' className='underline hover:text-accent'>
            learning path ready
          </Link>
        )}
      </div>
      <button
        onClick={handleStartOver}
        className='text-[var(--text-sm)] text-ink-muted hover:text-ink'
      >
        Start over
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/OutputsBanner.tsx
git commit -m "Add OutputsBanner listing all output types with quick-jump links"
```

---

## Task 20: Wire landing page + drop pendingChatMessage from chat

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/chat/page.tsx`
- Delete: `components/landing/UploadCard.tsx`
- Delete: `components/landing/ChatCard.tsx`
- Delete: `components/landing/SessionBanner.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Hero from '@/components/Hero';
import InputsZone, { NO_HINTS, type MissingHints } from '@/components/landing/InputsZone';
import ActionsZone from '@/components/landing/ActionsZone';
import OutputsBanner from '@/components/landing/OutputsBanner';

export default function Home() {
  const [missingHints, setMissingHints] = useState<MissingHints>(NO_HINTS);

  function clearMissingHints() {
    setMissingHints(NO_HINTS);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <OutputsBanner />
        <InputsZone missingHints={missingHints} onClearHints={clearMissingHints} />
        <ActionsZone setMissingHints={setMissingHints} clearMissingHints={clearMissingHints} />
      </section>
    </div>
  );
}
```

(Note: `app/page.tsx` becomes a `'use client'` module because it owns the missingHints state. Hero is already a client component.)

- [ ] **Step 2: Drop the pendingChatMessage effect from `app/chat/page.tsx`**

Open `app/chat/page.tsx`. Locate the block:

```tsx
  // On mount, if the landing page staged a pending message, send it once.
  const pendingHandledRef = useRef(false);
  useEffect(() => {
    if (pendingHandledRef.current) return;
    const pending = useSessionStore.getState().pendingChatMessage;
    if (!pending) return;
    pendingHandledRef.current = true;
    useSessionStore.getState().setPendingChatMessage(null);
    handleSend(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Delete it entirely.

Also remove `useEffect, useRef` from the React import line if they're no longer used elsewhere in the file. Check the rest of `app/chat/page.tsx` — the file uses `useState` for `sending`, `paperclipOpen`, `reviewOpen`, etc. After the deletion, `useEffect` and `useRef` should both be unused; remove them from the import.

The import line should change from:
```ts
import { useEffect, useRef, useState } from 'react';
```
to:
```ts
import { useState } from 'react';
```

- [ ] **Step 3: Delete the old landing files**

```bash
rm components/landing/UploadCard.tsx
rm components/landing/ChatCard.tsx
rm components/landing/SessionBanner.tsx
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. The pre-existing errors from Tasks 1-19 (chat page + ChatCard referencing `pendingChatMessage`) are now resolved by this task.

If any errors remain, fix them — most likely `app/chat/page.tsx` still references `useEffect`/`useRef` somewhere, or the deleted files were still imported by some surviving file.

- [ ] **Step 5: Run tests**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`

Visit `http://localhost:3000/`. Expected:
- Hero renders
- Inputs zone shows 4 fields
- Actions zone shows 4 buttons
- OutputsBanner is hidden (no session state yet)

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/chat/page.tsx
git rm components/landing/UploadCard.tsx components/landing/ChatCard.tsx components/landing/SessionBanner.tsx
git commit -m "Wire unified landing; drop UploadCard, ChatCard, SessionBanner, pendingChatMessage

The landing page now uses InputsZone + ActionsZone + OutputsBanner.
The two old cards are deleted along with the SessionBanner they
sat next to. The chat page no longer reads pendingChatMessage —
that field is gone from the session store and the auto-send
effect is removed. Whatever's in the shared inputs still passes
to the chat as context via the existing buildContextBlock path."
```

---

## Task 21: Career card shortcuts (Analyse gaps + Learning path)

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Add new imports**

Open `components/CareerNode.tsx`. Add to the existing imports:

```tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchCheck, Route as RouteIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GapAnalysis, LearningPath } from '@/lib/session-store';
import { loadLLMConfig } from '@/lib/llm-client';
```

(Some of these may already be imported by Task 16 of Phase 1 — check first and avoid duplicates.)

- [ ] **Step 2: Add new handlers inside the component**

Inside the `CareerNode` component body, alongside the existing `handleChatAboutThis` from Phase 1, add:

```tsx
const router = useRouter();
const setGapAnalysis = useSessionStore((s) => s.setGapAnalysis);
const setLearningPath = useSessionStore((s) => s.setLearningPath);
const setStoreJobTitle = useSessionStore((s) => s.setJobTitle);
const [running, setRunning] = useState<'gaps' | 'learn' | null>(null);

async function handleAnalyseGaps() {
  if (!jobTitle) return;
  setStoreJobTitle(jobTitle);
  setRunning('gaps');
  try {
    const state = useSessionStore.getState();
    const llmConfig = await loadLLMConfig();
    const res = await fetch('/api/gapAnalysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle,
        resume: state.resumeText ?? undefined,
        aboutYou: state.freeText || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
        llmConfig,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gap analysis failed');
    }
    const { analysis } = (await res.json()) as { analysis: GapAnalysis };
    setGapAnalysis(analysis);
    router.push('/gap-analysis');
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
  } finally {
    setRunning(null);
  }
}

async function handleLearningPath() {
  if (!jobTitle) return;
  setStoreJobTitle(jobTitle);
  setRunning('learn');
  try {
    const state = useSessionStore.getState();
    const llmConfig = await loadLLMConfig();
    const res = await fetch('/api/learningPath', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobTitle,
        resume: state.resumeText ?? undefined,
        aboutYou: state.freeText || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
        llmConfig,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Learning path failed');
    }
    const { path } = (await res.json()) as { path: LearningPath };
    setLearningPath(path);
    router.push('/learning-path');
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Learning path failed');
  } finally {
    setRunning(null);
  }
}
```

- [ ] **Step 3: Update the dialog footer to include the new buttons**

Locate the existing footer row from Phase 1 (it currently contains a single "Chat about this" button). Replace it with:

```tsx
<div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4 mt-4'>
  <Button asChild variant='outline' onClick={handleChatAboutThis}>
    <Link href='/chat'>
      <MessageCircle className='w-4 h-4 mr-2' />
      Chat about this
    </Link>
  </Button>
  <Button variant='outline' onClick={handleAnalyseGaps} disabled={running !== null}>
    <SearchCheck className='w-4 h-4 mr-2' />
    {running === 'gaps' ? 'Analysing…' : 'Analyse gaps for this role'}
  </Button>
  <Button variant='outline' onClick={handleLearningPath} disabled={running !== null}>
    <RouteIcon className='w-4 h-4 mr-2' />
    {running === 'learn' ? 'Building…' : 'Learning path for this role'}
  </Button>
</div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/CareerNode.tsx
git commit -m "Add Analyse gaps and Learning path shortcut buttons to career card"
```

---

## Task 22: Manual QA

**Files:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all PASS. Should be ~50+ tests across all the new modules plus the Phase 1 ones.

- [ ] **Step 2: Run the type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Walk the manual QA checklist in the Electron dev build**

Run: `npm run electron:dev`

Walk this list, tick items as they pass:

- [ ] Landing renders Hero, InputsZone (4 fields), ActionsZone (4 buttons), no OutputsBanner
- [ ] Type a job title only, click Gap analysis → inline hint highlights "About you" + Resume, message says profile required
- [ ] Add a resume, click Gap analysis → runs, navigates to `/gap-analysis`
- [ ] Gap page shows summary, matches, gaps with severity badges
- [ ] Expand a single gap row → target level, current level (if present), evidence visible
- [ ] "Show all details" expands all rows; "Hide all details" collapses them
- [ ] Copy as Markdown → paste into a notes app, verify readable
- [ ] Click "Turn this into a learning path →" → spinner appears, then navigates
- [ ] Learning path page shows summary, total duration, caveats, prerequisites, milestones, portfolio project
- [ ] Expand a milestone → activities and outcome visible
- [ ] Click "Run gap analysis for this target →" → returns to gap analysis page
- [ ] Back to landing, paste a job advert, click Gap analysis → runs successfully
- [ ] On landing, click Find my careers (with at least one input) → spider graph renders
- [ ] On a career card, click "Analyse gaps for this role" → runs directly, navigates
- [ ] On a career card, click "Learning path for this role" → runs directly, navigates
- [ ] On a career card, click "Chat about this" (existing Phase 1 behaviour) → still works
- [ ] Have a chat session, distill a profile, then return to landing → "About you" pre-filled with paragraph and the hint visible
- [ ] Edit "About you" → hint disappears
- [ ] OutputsBanner shows all four labels when all are populated, each link navigates correctly
- [ ] Start over from landing → confirms, clears store, banner disappears
- [ ] Start over from gap analysis page → returns to landing with empty store
- [ ] Empty `/gap-analysis` (visit directly with no analysis) → "No analysis yet" + back link
- [ ] Empty `/learning-path` (visit directly with no path) → "No learning path yet" + back link
- [ ] Click Learning path with only a job title (no profile) → runs, page renders, "Run gap analysis for this target" button is hidden
- [ ] Click Learning path with job title + resume → runs, "Run gap analysis for this target" button is visible
- [ ] Header and footer remain pinned on every page; pages scroll their own content
- [ ] Window can still be dragged on macOS (regression check from earlier fix)

- [ ] **Step 4: Stop the Electron dev instance**

- [ ] **Step 5: Commit any fixes**

If any QA item fails and you fix it, commit each fix with a message like `Fix: <short description>` before marking the item complete.

- [ ] **Step 6: Final commit (only if no fixes were needed)**

If everything passed, no additional commit needed — Phase 2 is complete.

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| `jobAdvert` field on session store | Task 1 |
| `GapAnalysis`, `LearningPath`, `Gap`, `LearningMilestone`, `GapSeverity`, `GapCategory` types | Task 1 |
| `setGapAnalysis`, `setLearningPath`, `setJobAdvert` actions | Task 1 |
| Drop `pendingChatMessage` field and chat auto-send | Tasks 1, 20 |
| `reset()` clears all new fields | Task 1 |
| Promote `isTokenLimitError` to a shared helper | Task 2 |
| `buildCareersPrompt` accepts `jobAdvert` | Task 3 |
| Chat route's `buildContextBlock` accepts `jobAdvert` | Task 3 |
| `profileToReadableText` helper | Task 4 |
| `buildGapAnalysisPrompt` + `parseGapAnalysis` | Task 5 |
| `buildLearningPathPrompt` + `parseLearningPath` | Task 6 |
| `gapAnalysisToMarkdown` + `learningPathToMarkdown` | Task 7 |
| `/api/gapAnalysis` route with trim fallback | Task 8 |
| `/api/learningPath` route with trim fallback | Task 9 |
| `CopyMarkdownButton` shared component | Task 10 |
| `GapItem` collapsible row | Task 11 |
| `GapAnalysisView` with Show all details + chain to learning path | Task 12 |
| `/gap-analysis` page reading from store, empty state | Task 13 |
| `MilestoneItem` collapsible row | Task 14 |
| `LearningPathView` with Show all details + reverse chain | Task 15 |
| `/learning-path` page reading from store, empty state | Task 16 |
| `InputsZone` with 4 fields and About-you pre-fill | Task 17 |
| `ActionsZone` with 4 buttons + inline missing-input prompting + run state | Task 18 |
| `OutputsBanner` replacing `SessionBanner` | Task 19 |
| Wire landing page; delete UploadCard, ChatCard, SessionBanner | Task 20 |
| Career card "Analyse gaps for this role" + "Learning path for this role" buttons | Task 21 |
| Manual QA checklist | Task 22 |

No gaps. Type names are consistent throughout: `GapAnalysis`, `LearningPath`, `Gap`, `LearningMilestone`, `GapSeverity`, `GapCategory`, `GapAnalysisInput`, `LearningPathInput`, `MissingHints`. Prop names match between components (e.g., `expanded`/`onToggle` on both `GapItem` and `MilestoneItem`).
