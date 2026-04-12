# Phase 1 — Conversational Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Career Compass from a one-shot resume analyser into an interactive advisor with a chat entry point, a flexible-input upload entry point, and a round-trip loop where chat distills into a `StudentProfile` and the spider graph feeds back into the chat via focus markers.

**Architecture:** A Zustand session store in `lib/session-store.ts` holds inputs, chat messages, and outputs — both entry points read/write to it. New API routes `app/api/chat/route.ts` and `app/api/distillProfile/route.ts` reuse the existing `lib/llm-providers.ts` abstraction. The existing `app/api/getCareers/route.ts` gets a unified input shape (`resume | freeText | jobTitle | distilledProfile`). UI: two peer entry-point cards on `app/page.tsx`; a new `app/chat/page.tsx`; `app/careers/page.tsx` refactored to read from the store.

**Tech Stack:** Next.js 14 App Router · TypeScript · Zustand (new) · Vitest (new) · existing Tailwind / Radix / react-hot-toast / ReactFlow stack.

**Spec reference:** `docs/superpowers/specs/2026-04-13-phase1-conversational-foundation-design.md`

---

## Notes for the implementer

- **Existing entry-point layout.** Today, `app/page.tsx` is a marketing landing (Hero + CTA). The traditional upload form currently lives at `app/careers/page.tsx` and that same page also renders the ReactFlow graph once careers exist. Phase 1 splits these: the upload form (enhanced with a job-title field) moves into a landing card on `app/page.tsx`; `app/careers/page.tsx` becomes a graph-only page that reads from the session store. Don't try to keep the old dual-purpose `/careers` page.
- **Testing scope.** No React-component rendering tests in Phase 1. Vitest covers: pure functions (store actions, prompt builders, trim helpers, JSON validation). API route handlers are kept thin and delegate to pure helpers so we can unit-test the helpers. Everything UI-facing is covered by the manual QA checklist in Task 22.
- **TDD.** For every pure-function task: test first, verify it fails, implement, verify it passes, commit. For UI tasks (no unit tests), still commit at the end of each task.
- **Frequent commits.** One commit per task minimum. Commit messages use the existing repo style (seen in `git log`): short imperative subject, optional body.
- **File paths are absolute from the repo root** (`/Users/michael/Projects/career-compass/...`). All examples below omit the repo-root prefix.
- **Don't reformat unrelated files.** Several existing files in `git status` already have uncommitted modifications — leave them alone unless a task specifically touches them.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Minimal Vitest config (node env, `lib/**/*.test.ts`). |
| `lib/session-store.ts` | Zustand store: inputs, chat messages, focus, distilled profile, careers, actions. |
| `lib/session-store.test.ts` | Unit tests for store actions. |
| `lib/prompts/advisor.ts` | Advisor system prompt (B-with-warmth) + focus-line helper. |
| `lib/prompts/careers.ts` | `buildCareersPrompt()` pure function — unified input shape → prompt strings. |
| `lib/prompts/careers.test.ts` | Snapshot-style tests for each input combination. |
| `lib/prompts/distill.ts` | `buildDistillationPrompt()` + `parseDistilledProfile()` — JSON shape guard. |
| `lib/prompts/distill.test.ts` | Tests for prompt builder and JSON validation. |
| `lib/chat-history.ts` | `trimHistory()` — keep system + last N messages + attachments. |
| `lib/chat-history.test.ts` | Tests for trim behaviour. |
| `lib/llm-client.ts` | `loadLLMConfig()` — shared client-side helper (currently duplicated in `app/careers/page.tsx`). |
| `app/api/chat/route.ts` | POST chat endpoint. Thin wrapper over `lib/llm-providers.ts` and `lib/chat-history.ts`. |
| `app/api/distillProfile/route.ts` | POST distillation endpoint. Thin wrapper over `lib/llm-providers.ts` and `lib/prompts/distill.ts`. |
| `app/chat/page.tsx` | Chat page shell — top bar, message list, composer. |
| `components/chat/ChatTopBar.tsx` | Title, focus chip, "Generate careers from this chat" button, "Start over" button. |
| `components/chat/ChatMessageList.tsx` | Message rendering (user/assistant/focus-marker/attachment-summary/notice). |
| `components/chat/ChatComposer.tsx` | Text input, send button, paperclip trigger. |
| `components/chat/PaperclipMenu.tsx` | Three attach options: resume file, paste text, add job title. |
| `components/chat/ProfileReviewModal.tsx` | Editable `StudentProfile` review, redistill-with-guidance, accept. |
| `components/landing/UploadCard.tsx` | Resume drop + free-text + job-title inputs + "Find my careers" CTA. |
| `components/landing/ChatCard.tsx` | "Chat with an Advisor" CTA card. |

### Modified files

| Path | Change |
|---|---|
| `package.json` | Add `zustand`, `vitest`, `@vitest/ui` (optional), `test` script. |
| `app/page.tsx` | Add two-card entry-point row below Hero. |
| `app/careers/page.tsx` | Strip upload form; read all state from session store; render graph; add "Start over" action. |
| `app/api/getCareers/route.ts` | Accept unified input `{ resume, freeText, jobTitle, distilledProfile, llmConfig }`; delegate prompt construction to `lib/prompts/careers.ts`. |
| `components/CareerNode.tsx` | Add "Chat about this" button inside dialog (sets focus, navigates to `/chat`). |

### Removed from old locations

Nothing is physically deleted, but the upload form and `generateCareers` logic move out of `app/careers/page.tsx`.

---

## Task 1: Install dependencies and set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install zustand
npm install -D vitest
```

Expected: `zustand` appears under `dependencies`, `vitest` under `devDependencies`, `package-lock.json` updated.

- [ ] **Step 2: Add `test` script to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 4: Sanity-check Vitest runs**

Run: `npm run test`
Expected: Vitest starts, reports "No test files found, exiting with code 0" (or similar success). If it exits with failure, fix before proceeding.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "Add zustand and vitest for Phase 1"
```

---

## Task 2: Session store types and skeleton (TDD)

**Files:**
- Create: `lib/session-store.ts`
- Create: `lib/session-store.test.ts`

- [ ] **Step 1: Write the failing test for initial state**

Create `lib/session-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('has empty initial state', () => {
    const s = useSessionStore.getState();
    expect(s.resumeText).toBeNull();
    expect(s.resumeFilename).toBeNull();
    expect(s.freeText).toBe('');
    expect(s.jobTitle).toBe('');
    expect(s.chatMessages).toEqual([]);
    expect(s.currentFocus).toBeNull();
    expect(s.distilledProfile).toBeNull();
    expect(s.careers).toBeNull();
    expect(s.selectedCareerId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/session-store.test.ts`
Expected: FAIL (module `./session-store` not found).

- [ ] **Step 3: Implement the store with types and initial state**

Create `lib/session-store.ts`:
```ts
import { create } from 'zustand';
import type { finalCareerInfo } from '@/lib/types';

export type StudentProfile = {
  background: string;
  interests: string[];
  skills: string[];
  constraints: string[];
  goals: string[];
};

export type ChatMessageKind =
  | 'message'
  | 'focus-marker'
  | 'attachment-summary'
  | 'notice';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  kind: ChatMessageKind;
};

export type SessionState = {
  // Inputs
  resumeText: string | null;
  resumeFilename: string | null;
  freeText: string;
  jobTitle: string;

  // Chat
  chatMessages: ChatMessage[];
  currentFocus: string | null;

  // Outputs
  distilledProfile: StudentProfile | null;
  careers: finalCareerInfo[] | null;
  selectedCareerId: string | null;

  // Actions
  setResume: (text: string, filename: string) => void;
  clearResume: () => void;
  setFreeText: (text: string) => void;
  setJobTitle: (title: string) => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'> & Partial<Pick<ChatMessage, 'id' | 'timestamp' | 'kind'>>) => void;
  replaceChatMessages: (msgs: ChatMessage[]) => void;
  setFocus: (career: string | null) => void;
  setDistilledProfile: (profile: StudentProfile | null) => void;
  setCareers: (careers: finalCareerInfo[] | null) => void;
  reset: () => void;
};

const initialState = {
  resumeText: null,
  resumeFilename: null,
  freeText: '',
  jobTitle: '',
  chatMessages: [],
  currentFocus: null,
  distilledProfile: null,
  careers: null,
  selectedCareerId: null,
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setResume: (text, filename) =>
    set({ resumeText: text, resumeFilename: filename }),
  clearResume: () => set({ resumeText: null, resumeFilename: null }),
  setFreeText: (text) => set({ freeText: text }),
  setJobTitle: (title) => set({ jobTitle: title }),

  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [
        ...s.chatMessages,
        {
          id: msg.id ?? makeId(),
          timestamp: msg.timestamp ?? Date.now(),
          kind: msg.kind ?? 'message',
          role: msg.role,
          content: msg.content,
        },
      ],
    })),

  replaceChatMessages: (msgs) => set({ chatMessages: msgs }),

  setFocus: (career) => set({ currentFocus: career }),
  setDistilledProfile: (profile) => set({ distilledProfile: profile }),
  setCareers: (careers) => set({ careers }),

  reset: () => set({ ...initialState }),
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/session-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "Add session store with initial-state test"
```

---

## Task 3: Session store action tests

**Files:**
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Add failing action tests**

Append to `lib/session-store.test.ts`:
```ts
describe('session store actions', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('setResume writes text and filename', () => {
    useSessionStore.getState().setResume('my resume', 'cv.pdf');
    const s = useSessionStore.getState();
    expect(s.resumeText).toBe('my resume');
    expect(s.resumeFilename).toBe('cv.pdf');
  });

  it('clearResume nulls text and filename', () => {
    useSessionStore.getState().setResume('x', 'y.pdf');
    useSessionStore.getState().clearResume();
    const s = useSessionStore.getState();
    expect(s.resumeText).toBeNull();
    expect(s.resumeFilename).toBeNull();
  });

  it('addChatMessage appends with auto id/timestamp/kind', () => {
    useSessionStore.getState().addChatMessage({
      role: 'user',
      content: 'hello',
    });
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hello');
    expect(msgs[0].id).toBeTruthy();
    expect(msgs[0].kind).toBe('message');
    expect(typeof msgs[0].timestamp).toBe('number');
  });

  it('addChatMessage respects explicit kind', () => {
    useSessionStore.getState().addChatMessage({
      role: 'system',
      content: '— Now focused on Data Analyst —',
      kind: 'focus-marker',
    });
    expect(useSessionStore.getState().chatMessages[0].kind).toBe('focus-marker');
  });

  it('setFocus updates currentFocus', () => {
    useSessionStore.getState().setFocus('Data Analyst');
    expect(useSessionStore.getState().currentFocus).toBe('Data Analyst');
    useSessionStore.getState().setFocus(null);
    expect(useSessionStore.getState().currentFocus).toBeNull();
  });

  it('reset clears everything', () => {
    const s = useSessionStore.getState();
    s.setResume('a', 'b');
    s.setFreeText('c');
    s.setJobTitle('d');
    s.addChatMessage({ role: 'user', content: 'e' });
    s.setFocus('f');
    s.setDistilledProfile({
      background: 'g', interests: [], skills: [], constraints: [], goals: [],
    });
    s.reset();
    const after = useSessionStore.getState();
    expect(after.resumeText).toBeNull();
    expect(after.freeText).toBe('');
    expect(after.jobTitle).toBe('');
    expect(after.chatMessages).toEqual([]);
    expect(after.currentFocus).toBeNull();
    expect(after.distilledProfile).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

Run: `npm run test -- lib/session-store.test.ts`
Expected: PASS (all 7 tests).

If any fail, fix the store implementation from Task 2.

- [ ] **Step 3: Commit**

```bash
git add lib/session-store.test.ts
git commit -m "Add session store action tests"
```

---

## Task 4: Careers prompt builder (TDD)

**Files:**
- Create: `lib/prompts/careers.ts`
- Create: `lib/prompts/careers.test.ts`

- [ ] **Step 1: Write failing tests for `buildCareersPrompt`**

Create `lib/prompts/careers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildCareersPrompt } from './careers';

describe('buildCareersPrompt', () => {
  it('includes resume when provided', () => {
    const out = buildCareersPrompt({ resume: 'experienced in sql' });
    expect(out).toContain('experienced in sql');
    expect(out).toContain('<resume>');
  });

  it('includes free text when provided', () => {
    const out = buildCareersPrompt({ freeText: 'i like teaching' });
    expect(out).toContain('i like teaching');
    expect(out).toContain('<additionalContext>');
  });

  it('includes job title when provided', () => {
    const out = buildCareersPrompt({ jobTitle: 'Data Analyst' });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('curious about becoming');
  });

  it('includes distilled profile when provided', () => {
    const out = buildCareersPrompt({
      distilledProfile: {
        background: 'CS student',
        interests: ['data', 'teaching'],
        skills: ['python'],
        constraints: ['remote only'],
        goals: ['data role'],
      },
    });
    expect(out).toContain('CS student');
    expect(out).toContain('data, teaching');
    expect(out).toContain('python');
    expect(out).toContain('remote only');
    expect(out).toContain('data role');
  });

  it('combines all four inputs', () => {
    const out = buildCareersPrompt({
      resume: 'R',
      freeText: 'F',
      jobTitle: 'Analyst',
      distilledProfile: {
        background: 'B',
        interests: ['I'],
        skills: ['S'],
        constraints: ['C'],
        goals: ['G'],
      },
    });
    expect(out).toContain('R');
    expect(out).toContain('F');
    expect(out).toContain('Analyst');
    expect(out).toContain('B');
  });

  it('throws when all inputs empty', () => {
    expect(() => buildCareersPrompt({})).toThrow();
  });

  it('asks for JSON output', () => {
    const out = buildCareersPrompt({ freeText: 'x' });
    expect(out).toMatch(/JSON/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/prompts/careers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `buildCareersPrompt`**

Create `lib/prompts/careers.ts`:
```ts
import type { StudentProfile } from '@/lib/session-store';

export type CareersInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  distilledProfile?: StudentProfile;
};

const EXAMPLE = `<example>
[
  {
    "jobTitle": "UX Designer",
    "jobDescription": "Creates user-centered design solutions to improve product usability and user experience.",
    "timeline": "3-6 months",
    "salary": "$85k - $110k",
    "difficulty": "Medium"
  },
  {
    "jobTitle": "Digital Marketing Specialist",
    "jobDescription": "Develops and implements online marketing campaigns to drive business growth.",
    "timeline": "2-4 months",
    "salary": "$50k - $70k",
    "difficulty": "Low"
  }
]
</example>`;

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

export function buildCareersPrompt(input: CareersInput): string {
  const { resume, freeText, jobTitle, distilledProfile } = input;

  const hasAny =
    (resume && resume.trim()) ||
    (freeText && freeText.trim()) ||
    (jobTitle && jobTitle.trim()) ||
    distilledProfile;

  if (!hasAny) {
    throw new Error('buildCareersPrompt: at least one input is required');
  }

  const sections: string[] = [];

  sections.push(
    `Give me 6 career paths that the following user could transition into based on the information below. Respond in JSON: {jobTitle: string, jobDescription: string, timeline: string, salary: string, difficulty: string}.`
  );

  sections.push(EXAMPLE);

  if (jobTitle && jobTitle.trim()) {
    sections.push(
      `<jobTitleOfInterest>\nThe student is curious about becoming a ${jobTitle.trim()}. Generate 6 adjacent or alternative career paths they might explore, including the stated one and variants/progressions.\n</jobTitleOfInterest>`
    );
  }

  if (resume && resume.trim()) {
    sections.push(`<resume>\n${resume.trim()}\n</resume>`);
  }

  if (freeText && freeText.trim()) {
    sections.push(`<additionalContext>\n${freeText.trim()}\n</additionalContext>`);
  }

  if (distilledProfile) {
    sections.push(
      `<distilledProfile>\n${formatProfile(distilledProfile)}\n</distilledProfile>`
    );
  }

  sections.push('ONLY respond with JSON, nothing else.');

  return sections.join('\n\n');
}

export function buildCareerDetailPrompt(
  career: { jobTitle: string; timeline: string },
  input: CareersInput
): string {
  const parts: string[] = [];
  if (input.resume) parts.push(input.resume);
  if (input.freeText) parts.push(input.freeText);
  if (input.jobTitle) parts.push(`Student stated interest: ${input.jobTitle}`);
  if (input.distilledProfile) parts.push(formatProfile(input.distilledProfile));

  const context = parts.join('\n\n');

  return `You are helping a person transition into the ${career.jobTitle} role in ${career.timeline}. Given the context about the person, return more information about the ${career.jobTitle} role in JSON as follows: {workRequired: string, aboutTheRole: string, whyItsagoodfit: array[], roadmap: [{string: string}, ...]}

<context>
${context}
</context>

ONLY respond with JSON, nothing else.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/prompts/careers.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/careers.ts lib/prompts/careers.test.ts
git commit -m "Add careers prompt builder with unified input shape"
```

---

## Task 5: Update `getCareers` route to use unified input

**Files:**
- Modify: `app/api/getCareers/route.ts`

- [ ] **Step 1: Rewrite route handler to use `buildCareersPrompt`**

Replace the entire contents of `app/api/getCareers/route.ts` with:
```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import {
  buildCareersPrompt,
  buildCareerDetailPrompt,
  type CareersInput,
} from '@/lib/prompts/careers';

interface GetCareersRequest extends CareersInput {
  llmConfig?: LLMConfig;
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GetCareersRequest;
    const { llmConfig: clientConfig, ...input } = body;

    const llmConfig = clientConfig || (await getLLMConfig());
    console.log(
      '[getCareers] Using provider:',
      llmConfig.provider,
      'model:',
      llmConfig.model,
      'hasKey:',
      !!llmConfig.apiKey
    );

    const llmProvider = getLLMProvider(llmConfig);
    const userPrompt = buildCareersPrompt(input);

    const careers = await llmProvider.createCompletion(
      [
        {
          role: 'system',
          content: 'You are a helpful career expert that ONLY responds in JSON.',
        },
        { role: 'user', content: userPrompt },
      ],
      llmConfig
    );

    console.log('[getCareers] Initial careers response length:', careers?.length);
    const careerInfoJSON = JSON.parse(cleanJSON(careers!));

    const finalResults = await Promise.all(
      careerInfoJSON.map(async (career: any) => {
        try {
          const detailPrompt = buildCareerDetailPrompt(career, input);
          const specificCareer = await llmProvider.createCompletion(
            [
              {
                role: 'system',
                content:
                  'You are a helpful career expert that ONLY responds in JSON.',
              },
              { role: 'user', content: detailPrompt },
            ],
            llmConfig
          );
          const specificCareerJSON = JSON.parse(cleanJSON(specificCareer));
          return { ...career, ...specificCareerJSON };
        } catch (error) {
          console.error('[getCareers] Detail error for', career.jobTitle, ':', error);
          return career;
        }
      })
    );

    return new Response(JSON.stringify(finalResults), { status: 200 });
  } catch (error) {
    console.error('[getCareers] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (Pre-existing errors in unrelated files are OK if they already exist on `main` — compare before/after.)

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: PASS — the new prompt-builder tests still pass, nothing broke.

- [ ] **Step 4: Commit**

```bash
git add app/api/getCareers/route.ts
git commit -m "Thread unified input through getCareers route"
```

---

## Task 6: Chat history trim helper (TDD)

**Files:**
- Create: `lib/chat-history.ts`
- Create: `lib/chat-history.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/chat-history.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { trimHistory } from './chat-history';
import type { ChatMessage } from './session-store';

function msg(role: ChatMessage['role'], content: string, kind: ChatMessage['kind'] = 'message'): ChatMessage {
  return { id: Math.random().toString(), role, content, timestamp: Date.now(), kind };
}

describe('trimHistory', () => {
  it('returns all messages when under limit', () => {
    const msgs = [msg('user', 'a'), msg('assistant', 'b')];
    expect(trimHistory(msgs, 10)).toEqual(msgs);
  });

  it('keeps only the last N messages when over limit', () => {
    const msgs = Array.from({ length: 25 }, (_, i) => msg('user', `m${i}`));
    const trimmed = trimHistory(msgs, 10);
    expect(trimmed).toHaveLength(10);
    expect(trimmed[0].content).toBe('m15');
    expect(trimmed[9].content).toBe('m24');
  });

  it('always keeps attachment-summary messages regardless of position', () => {
    const msgs = [
      msg('system', 'attached resume', 'attachment-summary'),
      ...Array.from({ length: 25 }, (_, i) => msg('user', `m${i}`)),
    ];
    const trimmed = trimHistory(msgs, 10);
    expect(trimmed[0].kind).toBe('attachment-summary');
    expect(trimmed).toHaveLength(11); // 10 recent + 1 attachment
  });

  it('deduplicates if an attachment is already in the recent window', () => {
    const msgs = [
      msg('system', 'attached resume', 'attachment-summary'),
      msg('user', 'a'),
      msg('user', 'b'),
    ];
    const trimmed = trimHistory(msgs, 10);
    expect(trimmed).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/chat-history.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `trimHistory`**

Create `lib/chat-history.ts`:
```ts
import type { ChatMessage } from './session-store';

/**
 * Returns the last `keep` messages. Attachment-summary messages earlier in
 * the history are prepended so the advisor never loses the resume anchor.
 * Preserves ordering and deduplicates anything already in the recent window.
 */
export function trimHistory(messages: ChatMessage[], keep: number): ChatMessage[] {
  if (messages.length <= keep) return messages.slice();

  const recent = messages.slice(-keep);
  const recentIds = new Set(recent.map((m) => m.id));

  const olderAttachments = messages
    .slice(0, messages.length - keep)
    .filter((m) => m.kind === 'attachment-summary' && !recentIds.has(m.id));

  return [...olderAttachments, ...recent];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/chat-history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/chat-history.ts lib/chat-history.test.ts
git commit -m "Add trimHistory helper for long-chat fallback"
```

---

## Task 7: Advisor system prompt

**Files:**
- Create: `lib/prompts/advisor.ts`

- [ ] **Step 1: Create advisor prompt module**

Create `lib/prompts/advisor.ts`:
```ts
export const ADVISOR_SYSTEM_PROMPT = `You are a warm, encouraging career advisor for university students, many of whom are learning English as a second language. Speak clearly and simply. Be patient, curious, and supportive — celebrate progress, ask gentle follow-up questions, and help students articulate what they want.

SCOPE — you help with:
- Career exploration and path discovery
- Skills, study paths, qualifications
- Resume/CV advice, cover letters, interview preparation
- Salary, industry trends, job market questions
- Gap analysis between where they are and where they want to be

YOU DO NOT:
- Write code (Python, JavaScript, etc.) — if asked, briefly explain why the skill matters for their career and point to tools they could use (e.g., "a coding assistant or editor")
- Generate images, charts, or diagrams — if useful, describe what the image should show and suggest tools (Midjourney, DALL-E, Excel, Canva)
- Do homework or general-purpose chat — gently redirect to career topics
- Act as a therapist — if a student seems distressed, acknowledge briefly and suggest they speak to their university's student support services

When the student shares a resume, text, or job title, weave it naturally into the conversation. When the focus is set to a specific career, center your responses on that path while still answering related questions.

Language: match the student's level. If they write simply, respond simply. Never be condescending.`;

export function buildAdvisorSystemPrompt(currentFocus: string | null): string {
  if (!currentFocus) return ADVISOR_SYSTEM_PROMPT;
  return `${ADVISOR_SYSTEM_PROMPT}\n\nCurrent focus: ${currentFocus}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/prompts/advisor.ts
git commit -m "Add advisor system prompt with focus helper"
```

---

## Task 8: Chat API route

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor';
import { trimHistory } from '@/lib/chat-history';
import type { ChatMessage } from '@/lib/session-store';

interface ChatRequest {
  messages: ChatMessage[];
  currentFocus: string | null;
  llmConfig?: LLMConfig;
}

function isTokenLimitError(e: unknown): boolean {
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

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string
) {
  // Only 'message' and 'attachment-summary' kinds get sent to the LLM.
  // Focus-markers and notices are UI-only.
  const filtered = messages.filter(
    (m) => m.kind === 'message' || m.kind === 'attachment-summary'
  );
  return [
    { role: 'system' as const, content: systemPrompt },
    ...filtered.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role,
      content:
        m.kind === 'attachment-summary'
          ? `[Attachment shared by student]\n${m.content}`
          : m.content,
    })),
  ];
}

export async function POST(request: NextRequest) {
  try {
    const { messages, currentFocus, llmConfig: clientConfig } =
      (await request.json()) as ChatRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildAdvisorSystemPrompt(currentFocus);

    let trimmed = false;
    let reply: string;

    try {
      reply = await provider.createCompletion(
        toProviderMessages(messages, systemPrompt),
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimHistory(messages, 20);
      reply = await provider.createCompletion(
        toProviderMessages(shorter, systemPrompt),
        llmConfig
      );
    }

    return new Response(JSON.stringify({ reply, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[chat] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "Add chat API route with long-chat trim fallback"
```

---

## Task 9: Distillation prompt + parser (TDD)

**Files:**
- Create: `lib/prompts/distill.ts`
- Create: `lib/prompts/distill.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/prompts/distill.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildDistillationPrompt, parseDistilledProfile } from './distill';
import type { ChatMessage } from '@/lib/session-store';

function m(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: Math.random().toString(),
    role,
    content,
    timestamp: Date.now(),
    kind: 'message',
  };
}

describe('buildDistillationPrompt', () => {
  it('includes the full chat transcript', () => {
    const msgs = [m('user', 'I want to work with data'), m('assistant', 'Tell me more')];
    const out = buildDistillationPrompt({ messages: msgs });
    expect(out).toContain('I want to work with data');
    expect(out).toContain('Tell me more');
  });

  it('mentions JSON shape fields', () => {
    const out = buildDistillationPrompt({ messages: [m('user', 'x')] });
    expect(out).toContain('background');
    expect(out).toContain('interests');
    expect(out).toContain('skills');
    expect(out).toContain('constraints');
    expect(out).toContain('goals');
  });

  it('prepends the trim notice when trimmed=true', () => {
    const out = buildDistillationPrompt({ messages: [m('user', 'x')], trimmed: true });
    expect(out).toContain('recent portion of a longer conversation');
  });

  it('appends guidance when provided', () => {
    const out = buildDistillationPrompt({
      messages: [m('user', 'x')],
      guidance: 'focus on the data analyst thread',
    });
    expect(out).toContain('focus on the data analyst thread');
  });

  it('includes resume/text/title attachments when provided', () => {
    const out = buildDistillationPrompt({
      messages: [m('user', 'x')],
      resume: 'my resume',
      freeText: 'my text',
      jobTitle: 'Analyst',
    });
    expect(out).toContain('my resume');
    expect(out).toContain('my text');
    expect(out).toContain('Analyst');
  });
});

describe('parseDistilledProfile', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({
      background: 'CS student',
      interests: ['data'],
      skills: ['python'],
      constraints: [],
      goals: ['data role'],
    });
    const p = parseDistilledProfile(raw);
    expect(p.background).toBe('CS student');
    expect(p.interests).toEqual(['data']);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"background":"B","interests":[],"skills":[],"constraints":[],"goals":[]}\n```';
    const p = parseDistilledProfile(raw);
    expect(p.background).toBe('B');
  });

  it('throws on missing fields', () => {
    expect(() => parseDistilledProfile('{"background":"x"}')).toThrow();
  });

  it('coerces missing arrays to empty arrays when background is present', () => {
    const raw = JSON.stringify({
      background: 'B',
      interests: null,
      skills: undefined,
      constraints: [],
      goals: [],
    });
    const p = parseDistilledProfile(raw);
    expect(p.interests).toEqual([]);
    expect(p.skills).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/prompts/distill.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the module**

Create `lib/prompts/distill.ts`:
```ts
import type { ChatMessage, StudentProfile } from '@/lib/session-store';

export type DistillationInput = {
  messages: ChatMessage[];
  trimmed?: boolean;
  guidance?: string;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
};

function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.kind === 'message' || m.kind === 'attachment-summary')
    .map((m) => {
      const speaker =
        m.kind === 'attachment-summary'
          ? 'ATTACHMENT'
          : m.role === 'user'
          ? 'STUDENT'
          : 'ADVISOR';
      return `${speaker}: ${m.content}`;
    })
    .join('\n\n');
}

export function buildDistillationPrompt(input: DistillationInput): string {
  const sections: string[] = [];

  if (input.trimmed) {
    sections.push(
      'This is the recent portion of a longer conversation. Earlier messages were dropped to fit token limits — work with what you have.'
    );
  }

  sections.push(
    `Read the conversation below and distill it into a structured student profile. Respond ONLY with JSON in this exact shape:

{
  "background": string — a short paragraph about who the student is,
  "interests": string[] — career-relevant interests they've expressed,
  "skills": string[] — concrete skills they have or are building,
  "constraints": string[] — things limiting their options (location, time, visa, money, etc.),
  "goals": string[] — what they want from their career
}`
  );

  sections.push(`<conversation>\n${formatTranscript(input.messages)}\n</conversation>`);

  if (input.resume && input.resume.trim()) {
    sections.push(`<resume>\n${input.resume.trim()}\n</resume>`);
  }
  if (input.freeText && input.freeText.trim()) {
    sections.push(`<freeText>\n${input.freeText.trim()}\n</freeText>`);
  }
  if (input.jobTitle && input.jobTitle.trim()) {
    sections.push(`<jobTitleOfInterest>${input.jobTitle.trim()}</jobTitleOfInterest>`);
  }

  if (input.guidance && input.guidance.trim()) {
    sections.push(`<guidanceFromStudent>\n${input.guidance.trim()}\n</guidanceFromStudent>`);
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

export function parseDistilledProfile(raw: string): StudentProfile {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseDistilledProfile: not an object');
  }
  if (typeof parsed.background !== 'string' || !parsed.background.trim()) {
    throw new Error('parseDistilledProfile: missing background');
  }
  return {
    background: parsed.background,
    interests: toStringArray(parsed.interests),
    skills: toStringArray(parsed.skills),
    constraints: toStringArray(parsed.constraints),
    goals: toStringArray(parsed.goals),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/prompts/distill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/distill.ts lib/prompts/distill.test.ts
git commit -m "Add distillation prompt builder and profile parser"
```

---

## Task 10: Distillation API route

**Files:**
- Create: `app/api/distillProfile/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import {
  buildDistillationPrompt,
  parseDistilledProfile,
  type DistillationInput,
} from '@/lib/prompts/distill';
import { trimHistory } from '@/lib/chat-history';

interface DistillRequest extends Omit<DistillationInput, 'trimmed'> {
  llmConfig?: LLMConfig;
}

function isTokenLimitError(e: unknown): boolean {
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

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as DistillRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content:
              'You summarize career conversations into structured JSON profiles. Respond ONLY with JSON.',
          },
          { role: 'user', content: buildDistillationPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimHistory(input.messages, 30);
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content:
              'You summarize career conversations into structured JSON profiles. Respond ONLY with JSON.',
          },
          {
            role: 'user',
            content: buildDistillationPrompt({ ...input, messages: shorter, trimmed: true }),
          },
        ],
        llmConfig
      );
    }

    const profile = parseDistilledProfile(raw);
    return new Response(JSON.stringify({ profile, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[distillProfile] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/distillProfile/route.ts
git commit -m "Add distillProfile API route with trim fallback"
```

---

## Task 11: Shared LLM config loader

**Files:**
- Create: `lib/llm-client.ts`

The existing `app/careers/page.tsx` has an inlined `loadLLMConfig`-style block (lines 228–253). Later tasks need the same logic in `app/chat/page.tsx` and `app/page.tsx`. Extract it once.

- [ ] **Step 1: Create the helper**

```ts
import { settingsStore, secureStorage } from '@/lib/settings-store';
import type { LLMConfig } from '@/lib/llm-providers';

const ENV_VAR_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/**
 * Loads the current LLMConfig from settings + secure storage, falling back
 * to environment variables exposed via electronAPI.
 */
export async function loadLLMConfig(): Promise<LLMConfig> {
  const saved = await settingsStore.get();
  let apiKey = await secureStorage.getApiKey(saved.provider);

  if (!apiKey && typeof window !== 'undefined' && (window as any).electronAPI) {
    const envVar = ENV_VAR_MAP[saved.provider];
    if (envVar) {
      apiKey =
        (await (window as any).electronAPI.getEnvVar(envVar)) || '';
    }
  }

  return {
    provider: saved.provider,
    model: saved.model,
    apiKey: apiKey || '',
    baseURL: saved.baseURL,
  };
}

/**
 * Returns true if the user has configured a provider and model.
 * Used by landing card / chat page to decide whether to redirect to /settings.
 */
export async function isLLMConfigured(): Promise<boolean> {
  try {
    const saved = await settingsStore.get();
    return !!(saved.model && saved.model.trim());
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/llm-client.ts
git commit -m "Extract loadLLMConfig helper for reuse across pages"
```

---

## Task 12: Landing page — `UploadCard` component

**Files:**
- Create: `components/landing/UploadCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import LocalFileUpload from '@/components/LocalFileUpload';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { fileToArrayBuffer } from '@/lib/utils';
import { useSessionStore } from '@/lib/session-store';
import { isLLMConfigured } from '@/lib/llm-client';

export default function UploadCard() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [localFreeText, setLocalFreeText] = useState('');
  const [localJobTitle, setLocalJobTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const store = useSessionStore();

  const disabled =
    !selectedFile && !localFreeText.trim() && !localJobTitle.trim();

  async function handleSubmit() {
    if (disabled) return;
    setLoading(true);
    try {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }

      if (selectedFile) {
        const arrayBuffer = await fileToArrayBuffer(selectedFile);
        const res = await fetch('/api/parsePdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: Array.from(new Uint8Array(arrayBuffer)),
            filename: selectedFile.name,
          }),
        });
        const text = await res.json();
        store.setResume(text, selectedFile.name);
      }

      store.setFreeText(localFreeText);
      store.setJobTitle(localJobTitle);
      store.setCareers(null); // force regeneration on /careers

      router.push('/careers');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='border border-border rounded-lg p-8 bg-paper flex flex-col gap-5 w-full max-w-xl'>
      <div>
        <h2 className='text-[var(--text-xl)] font-semibold text-ink mb-2'>
          Upload & Explore
        </h2>
        <p className='text-ink-muted text-[var(--text-sm)]'>
          Upload a resume, describe yourself, or just tell us a job title you're
          curious about. Any combination works.
        </p>
      </div>

      <LocalFileUpload
        onFileSelect={(file) => {
          setSelectedFile(file);
          setFileName(file.name);
        }}
      />
      {fileName && (
        <p className='text-[var(--text-sm)] text-ink-muted'>Selected: {fileName}</p>
      )}

      <Textarea
        placeholder='Or describe your background, interests, and goals.'
        value={localFreeText}
        onChange={(e) => setLocalFreeText(e.target.value)}
        rows={4}
      />

      <Input
        placeholder='Or just tell me a job title (e.g., Data Analyst)'
        value={localJobTitle}
        onChange={(e) => setLocalJobTitle(e.target.value)}
      />

      <Button
        onClick={handleSubmit}
        disabled={disabled || loading}
        className='w-full'
      >
        {loading ? 'Working…' : 'Find my careers'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/UploadCard.tsx
git commit -m "Add UploadCard with resume/text/job-title inputs"
```

---

## Task 13: Landing page — `ChatCard` component

**Files:**
- Create: `components/landing/ChatCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ChatCard() {
  return (
    <div className='border border-border rounded-lg p-8 bg-paper flex flex-col gap-5 w-full max-w-xl'>
      <div>
        <h2 className='text-[var(--text-xl)] font-semibold text-ink mb-2'>
          Chat with an Advisor
        </h2>
        <p className='text-ink-muted text-[var(--text-sm)]'>
          Not sure where to start? Talk it through with a career advisor. You
          can attach a resume, text, or job title any time during the chat.
        </p>
      </div>
      <div className='flex-1' />
      <Button asChild className='w-full'>
        <Link href='/chat'>Start chatting</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/ChatCard.tsx
git commit -m "Add ChatCard entry point"
```

---

## Task 14: Wire two cards into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update the page**

Replace the contents of `app/page.tsx`:
```tsx
import CTA from '@/components/CTA';
import GradientWrapper from '@/components/GradientWrapper';
import Hero from '@/components/Hero';
import UploadCard from '@/components/landing/UploadCard';
import ChatCard from '@/components/landing/ChatCard';

export default function Home() {
  return (
    <>
      <Hero />
      <section className='px-6 py-16 flex justify-center'>
        <div className='flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center items-stretch'>
          <UploadCard />
          <ChatCard />
        </div>
      </section>
      <GradientWrapper />
      <CTA />
    </>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
Visit: `http://localhost:3000/`
Expected: Hero renders, two cards appear below it side-by-side (stack on mobile), "Start chatting" links to `/chat` (will 404 until Task 17), "Find my careers" is disabled until an input is added.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "Add two entry-point cards to landing page"
```

---

## Task 15: Refactor `/careers` to read from session store

**Files:**
- Modify: `app/careers/page.tsx`

The current `/careers` page owns local state for `selectedFile`, `additionalContext`, `careerInfo`, etc. Phase 1 moves all of that into the session store. This page now does one job: render the ReactFlow graph, triggering `getCareers` on mount if `careers` is null.

- [ ] **Step 1: Replace the page contents**

```tsx
'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import CareerNode from '@/components/CareerNode';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Node, NodeTypes } from 'reactflow';
import { Button } from '@/components/ui/button';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

const nodeTypes = { careerNode: CareerNode } satisfies NodeTypes;

const positions = [
  { x: 50, y: 550, connectPosition: 'top' },
  { x: 1050, y: 550, connectPosition: 'top' },
  { x: 50, y: 150, connectPosition: 'bottom' },
  { x: 1050, y: 150, connectPosition: 'bottom' },
  { x: 550, y: 700, connectPosition: 'top' },
  { x: 550, y: 0, connectPosition: 'bottom' },
];

function makeNodes(careers: any[]): Node[] {
  const root: Node = {
    id: '1',
    position: { x: 650, y: 450 },
    data: { label: 'Careers' },
    style: {
      background: 'hsl(var(--ink))',
      color: 'hsl(var(--paper))',
      fontSize: '20px',
      borderRadius: '6px',
    },
  };
  const cards: Node[] = careers.slice(0, 6).map((c, i) => ({
    id: String(i + 2),
    type: 'careerNode',
    position: { x: positions[i].x, y: positions[i].y },
    data: { ...c, connectPosition: positions[i].connectPosition },
  }));
  return [root, ...cards];
}

function makeEdges(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `e1-${i + 2}`,
    source: '1',
    target: String(i + 2),
    animated: true,
    style: { stroke: 'hsl(var(--ink-muted))' },
  }));
}

export default function CareersPage() {
  const router = useRouter();
  const store = useSessionStore();
  const {
    resumeText,
    freeText,
    jobTitle,
    distilledProfile,
    careers,
  } = store;

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as any[]);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    (async () => setNeedsSetup(!(await isLLMConfigured())))();
  }, []);

  // Sync ReactFlow nodes with session-store careers.
  useEffect(() => {
    if (!careers || careers.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setNodes(makeNodes(careers));
    setEdges(makeEdges(Math.min(careers.length, 6)));
  }, [careers, setNodes, setEdges]);

  // Generate careers on mount if we have inputs but no careers yet.
  useEffect(() => {
    const hasInput =
      !!resumeText ||
      !!freeText.trim() ||
      !!jobTitle.trim() ||
      !!distilledProfile;
    if (!hasInput || careers || loading || needsSetup) return;

    (async () => {
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/getCareers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: resumeText ?? undefined,
            freeText: freeText || undefined,
            jobTitle: jobTitle || undefined,
            distilledProfile: distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to generate careers');
        }
        const data = await res.json();
        store.setCareers(data);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to generate');
      } finally {
        setLoading(false);
      }
    })();
  }, [resumeText, freeText, jobTitle, distilledProfile, careers, loading, needsSetup, store]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  if (needsSetup) {
    return (
      <div className='p-10 flex flex-col items-center'>
        <h1 className='text-[var(--text-2xl)] font-semibold text-ink mb-4'>
          Set up an AI provider
        </h1>
        <Link href='/settings' className='underline'>
          Go to Settings
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='p-10 flex flex-col items-center gap-4'>
        <LoadingDots style='big' color='gray' />
        <p className='text-ink-muted'>Generating career paths…</p>
      </div>
    );
  }

  if (!careers || careers.length === 0) {
    return (
      <div className='p-10 flex flex-col items-center gap-4'>
        <p className='text-ink-muted'>No careers yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }

  return (
    <div>
      <div className='flex justify-end p-4 gap-3'>
        <Button variant='outline' onClick={handleStartOver}>
          Start over
        </Button>
      </div>
      <div className='w-screen h-[1200px] mx-auto'>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
        >
          <Controls />
        </ReactFlow>
      </div>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
- Visit `/` → enter a job title in UploadCard → click "Find my careers" → should navigate to `/careers` → generate → render graph.
- Click "Start over" → confirm → session clears, back to `/`.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add app/careers/page.tsx
git commit -m "Refactor /careers to read from session store"
```

---

## Task 16: Add "Chat about this" action to `CareerNode`

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Add a button inside the dialog content**

At the top of `components/CareerNode.tsx`, add these imports beside the existing ones:
```tsx
import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';
import { MessageCircle } from 'lucide-react';
```

Inside the component, before `return`, add:
```tsx
const setFocus = useSessionStore((s) => s.setFocus);
const addChatMessage = useSessionStore((s) => s.addChatMessage);

function handleChatAboutThis() {
  if (!jobTitle) return;
  setFocus(jobTitle);
  addChatMessage({
    role: 'system',
    kind: 'focus-marker',
    content: `— Now focused on ${jobTitle} —`,
  });
}
```

Inside `<DialogContent>`, just before the closing tag, add a footer row:
```tsx
<div className='flex justify-end border-t border-border pt-4 mt-4'>
  <Button asChild variant='outline' onClick={handleChatAboutThis}>
    <Link href='/chat'>
      <MessageCircle className='w-4 h-4 mr-2' />
      Chat about this
    </Link>
  </Button>
</div>
```

You'll also need to import `Button`:
```tsx
import { Button } from '@/components/ui/button';
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/CareerNode.tsx
git commit -m "Add Chat about this action to career card"
```

---

## Task 17: Chat page shell — layout, top bar, message list skeleton

**Files:**
- Create: `app/chat/page.tsx`
- Create: `components/chat/ChatTopBar.tsx`
- Create: `components/chat/ChatMessageList.tsx`

- [ ] **Step 1: Create `ChatTopBar.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/lib/session-store';

type Props = {
  onGenerateCareers: () => void;
  canGenerate: boolean;
};

export default function ChatTopBar({ onGenerateCareers, canGenerate }: Props) {
  const router = useRouter();
  const currentFocus = useSessionStore((s) => s.currentFocus);
  const setFocus = useSessionStore((s) => s.setFocus);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);
  const reset = useSessionStore((s) => s.reset);

  function clearFocus() {
    setFocus(null);
    addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: '— focus cleared —',
    });
  }

  function startOver() {
    if (!confirm('Start over? This clears your session.')) return;
    reset();
    router.push('/');
  }

  return (
    <div className='border-b border-border px-6 py-4 flex items-center gap-4'>
      <h1 className='text-[var(--text-lg)] font-semibold text-ink'>
        Career Advisor
      </h1>
      {currentFocus && (
        <span className='inline-flex items-center gap-2 border border-accent/30 bg-accent-soft text-ink text-[var(--text-sm)] px-3 py-1 rounded-full'>
          Focused on: {currentFocus}
          <button
            onClick={clearFocus}
            className='text-ink-quiet hover:text-ink'
            aria-label='Clear focus'
          >
            <X className='w-3 h-3' />
          </button>
        </span>
      )}
      <div className='flex-1' />
      <Button
        onClick={onGenerateCareers}
        disabled={!canGenerate}
        className=''
      >
        Generate careers from this chat →
      </Button>
      <Button variant='outline' onClick={startOver}>
        Start over
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `ChatMessageList.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/session-store';

type Props = { messages: ChatMessage[] };

export default function ChatMessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className='flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3'>
      {messages.map((m) => {
        if (m.kind === 'focus-marker' || m.kind === 'notice') {
          return (
            <div
              key={m.id}
              className='self-center text-[var(--text-xs)] text-ink-quiet uppercase tracking-[0.18em] py-2'
            >
              {m.content}
            </div>
          );
        }

        if (m.kind === 'attachment-summary') {
          return (
            <div
              key={m.id}
              className='self-center max-w-md border border-border bg-accent-soft rounded-lg px-4 py-2 text-[var(--text-sm)] text-ink'
            >
              📎 {m.content}
            </div>
          );
        }

        const isUser = m.role === 'user';
        return (
          <div
            key={m.id}
            className={`max-w-[75%] px-4 py-3 rounded-lg ${
              isUser
                ? 'self-end bg-accent-soft text-ink'
                : 'self-start bg-paper border border-border text-ink'
            }`}
          >
            <div className='whitespace-pre-wrap leading-relaxed'>{m.content}</div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
```

- [ ] **Step 3: Create `app/chat/page.tsx`**

```tsx
'use client';

import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';

export default function ChatPage() {
  const messages = useSessionStore((s) => s.chatMessages);
  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3;

  function handleGenerateCareers() {
    // Wired in Task 20.
    alert('Profile review modal not yet implemented.');
  }

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={handleGenerateCareers}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <div className='border-t border-border px-6 py-4 text-ink-quiet text-[var(--text-sm)]'>
        Composer coming in the next task.
      </div>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev` → visit `/chat` → top bar renders, empty message area, placeholder composer.
Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/chat/page.tsx components/chat/ChatTopBar.tsx components/chat/ChatMessageList.tsx
git commit -m "Add chat page shell with top bar and message list"
```

---

## Task 18: Chat composer with send wired to `/api/chat`

**Files:**
- Create: `components/chat/ChatComposer.tsx`
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Create `ChatComposer.tsx`**

```tsx
'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  onSend: (text: string) => void;
  onPaperclip: () => void;
  disabled?: boolean;
};

export default function ChatComposer({ onSend, onPaperclip, disabled }: Props) {
  const [text, setText] = useState('');

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className='border-t border-border px-6 py-4 flex items-end gap-2'>
      <Button
        type='button'
        variant='outline'
        onClick={onPaperclip}
        disabled={disabled}
        aria-label='Attach'
      >
        <Paperclip className='w-4 h-4' />
      </Button>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        rows={2}
        placeholder='Type a message…'
        disabled={disabled}
        className='flex-1 resize-none'
      />
      <Button type='button' onClick={handleSend} disabled={disabled || !text.trim()}>
        <Send className='w-4 h-4' />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire composer into `/chat` and call `/api/chat`**

Replace the placeholder div in `app/chat/page.tsx`. The full updated file:
```tsx
'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useSessionStore } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function ChatPage() {
  const store = useSessionStore();
  const messages = store.chatMessages;
  const [sending, setSending] = useState(false);

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3;

  async function handleSend(text: string) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }

    store.addChatMessage({ role: 'user', content: text });
    setSending(true);

    try {
      const llmConfig = await loadLLMConfig();
      // Snapshot messages AFTER the new user message was added.
      const currentMessages = useSessionStore.getState().chatMessages;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          currentFocus: useSessionStore.getState().currentFocus,
          llmConfig,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Chat failed');
      }

      const { reply, trimmed } = (await res.json()) as {
        reply: string;
        trimmed: boolean;
      };

      if (trimmed) {
        store.addChatMessage({
          role: 'system',
          kind: 'notice',
          content:
            'Earlier messages were trimmed to fit — I still have your resume and recent context.',
        });
      }

      store.addChatMessage({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Chat failed');
      store.addChatMessage({
        role: 'assistant',
        content:
          "The advisor couldn't respond — check your provider settings and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  function handleGenerateCareers() {
    alert('Profile review modal — wired in Task 20.');
  }

  function handlePaperclip() {
    alert('Paperclip menu — wired in Task 19.');
  }

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={handleGenerateCareers}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <ChatComposer onSend={handleSend} onPaperclip={handlePaperclip} disabled={sending} />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` → visit `/chat` → type "I want to be a data analyst" → press Enter → advisor should respond.

(Requires a configured LLM provider. If not configured, expect a toast.)

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add components/chat/ChatComposer.tsx app/chat/page.tsx
git commit -m "Wire chat composer to /api/chat endpoint"
```

---

## Task 19: Paperclip menu — attach resume / text / job title

**Files:**
- Create: `components/chat/PaperclipMenu.tsx`
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Create `PaperclipMenu.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { FileText, Type, Briefcase, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { fileToArrayBuffer } from '@/lib/utils';
import { useSessionStore } from '@/lib/session-store';

type Props = { open: boolean; onClose: () => void };

type Mode = 'menu' | 'text' | 'title';

export default function PaperclipMenu({ open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [textValue, setTextValue] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const store = useSessionStore();

  if (!open) return null;

  function close() {
    setMode('menu');
    setTextValue('');
    setTitleValue('');
    onClose();
  }

  async function handleResume() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.md,.docx,.doc';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
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
        store.addChatMessage({
          role: 'system',
          kind: 'attachment-summary',
          content: `Attached resume: ${file.name} (${text.length} chars)`,
        });
        close();
      } catch (err) {
        console.error(err);
        toast.error('Could not parse that file.');
      }
    };
    input.click();
  }

  function submitText() {
    const t = textValue.trim();
    if (!t) return;
    store.addChatMessage({ role: 'user', content: t });
    store.setFreeText(t);
    close();
  }

  function submitTitle() {
    const t = titleValue.trim();
    if (!t) return;
    store.setJobTitle(t);
    store.addChatMessage({
      role: 'user',
      content: `I'm curious about becoming a ${t}.`,
    });
    close();
  }

  return (
    <div className='fixed inset-0 bg-ink/40 flex items-end md:items-center justify-center z-50'>
      <div className='bg-paper border border-border rounded-lg p-6 w-full max-w-md m-4'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>
            Add context
          </h2>
          <button onClick={close} className='text-ink-quiet hover:text-ink'>
            <X className='w-5 h-5' />
          </button>
        </div>

        {mode === 'menu' && (
          <div className='flex flex-col gap-2'>
            <Button variant='outline' onClick={handleResume} className='justify-start'>
              <FileText className='w-4 h-4 mr-2' /> Attach resume file
            </Button>
            <Button variant='outline' onClick={() => setMode('text')} className='justify-start'>
              <Type className='w-4 h-4 mr-2' /> Paste text
            </Button>
            <Button variant='outline' onClick={() => setMode('title')} className='justify-start'>
              <Briefcase className='w-4 h-4 mr-2' /> Add job title
            </Button>
          </div>
        )}

        {mode === 'text' && (
          <div className='flex flex-col gap-3'>
            <Textarea
              rows={5}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder='Paste anything — a description, a transcript, notes…'
            />
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setMode('menu')}>Back</Button>
              <Button onClick={submitText} disabled={!textValue.trim()}>Add</Button>
            </div>
          </div>
        )}

        {mode === 'title' && (
          <div className='flex flex-col gap-3'>
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder='e.g., Data Analyst'
            />
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setMode('menu')}>Back</Button>
              <Button onClick={submitTitle} disabled={!titleValue.trim()}>Add</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire menu into `/chat`**

In `app/chat/page.tsx`, replace the `handlePaperclip` stub and mount the menu. Full updated file:
```tsx
'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useSessionStore } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import PaperclipMenu from '@/components/chat/PaperclipMenu';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function ChatPage() {
  const store = useSessionStore();
  const messages = store.chatMessages;
  const [sending, setSending] = useState(false);
  const [paperclipOpen, setPaperclipOpen] = useState(false);

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3;

  async function handleSend(text: string) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    store.addChatMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const llmConfig = await loadLLMConfig();
      const currentMessages = useSessionStore.getState().chatMessages;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          currentFocus: useSessionStore.getState().currentFocus,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Chat failed');
      }
      const { reply, trimmed } = (await res.json()) as {
        reply: string;
        trimmed: boolean;
      };
      if (trimmed) {
        store.addChatMessage({
          role: 'system',
          kind: 'notice',
          content:
            'Earlier messages were trimmed to fit — I still have your resume and recent context.',
        });
      }
      store.addChatMessage({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Chat failed');
      store.addChatMessage({
        role: 'assistant',
        content:
          "The advisor couldn't respond — check your provider settings and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  function handleGenerateCareers() {
    alert('Profile review modal — wired in Task 20.');
  }

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={handleGenerateCareers}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <ChatComposer
        onSend={handleSend}
        onPaperclip={() => setPaperclipOpen(true)}
        disabled={sending}
      />
      <PaperclipMenu open={paperclipOpen} onClose={() => setPaperclipOpen(false)} />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` → visit `/chat` → click paperclip → try all three attach options → each should add an appropriate message to the chat.
Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add components/chat/PaperclipMenu.tsx app/chat/page.tsx
git commit -m "Add paperclip menu with resume/text/title attach"
```

---

## Task 20: Profile review modal and distillation wiring

**Files:**
- Create: `components/chat/ProfileReviewModal.tsx`
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Create `ProfileReviewModal.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { StudentProfile } from '@/lib/session-store';

type Props = {
  open: boolean;
  profile: StudentProfile | null;
  trimmed: boolean;
  onAccept: (profile: StudentProfile) => void;
  onRedistill: (guidance: string) => void;
  onCancel: () => void;
};

function ChipList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
        {label}
      </div>
      <div className='flex flex-wrap gap-2 mb-2'>
        {values.map((v, i) => (
          <span
            key={i}
            className='inline-flex items-center gap-1 border border-border bg-accent-soft rounded-full px-3 py-1 text-[var(--text-sm)]'
          >
            {v}
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              aria-label={`Remove ${v}`}
            >
              <X className='w-3 h-3' />
            </button>
          </span>
        ))}
      </div>
      <div className='flex gap-2'>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              onChange([...values, draft.trim()]);
              setDraft('');
            }
          }}
          placeholder={`Add ${label.toLowerCase()}…`}
        />
      </div>
    </div>
  );
}

export default function ProfileReviewModal({
  open,
  profile,
  trimmed,
  onAccept,
  onRedistill,
  onCancel,
}: Props) {
  const [local, setLocal] = useState<StudentProfile | null>(profile);
  const [guidance, setGuidance] = useState('');
  const [redistilling, setRedistilling] = useState(false);

  // Reset local copy when the modal opens with a new profile.
  if (open && profile && local !== profile && !redistilling) {
    setLocal(profile);
  }

  if (!open || !local) return null;

  return (
    <div className='fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4'>
      <div className='bg-paper border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-[var(--text-xl)] font-semibold text-ink'>
            Review your profile
          </h2>
          <button onClick={onCancel} className='text-ink-quiet hover:text-ink'>
            <X className='w-5 h-5' />
          </button>
        </div>

        {trimmed && (
          <div className='mb-4 p-3 border border-accent/30 bg-accent-soft rounded text-[var(--text-sm)] text-ink'>
            Your chat was long, so the profile was built from the most recent
            portion. Edit below to add anything important from earlier.
          </div>
        )}

        <div className='flex flex-col gap-4'>
          <div>
            <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Background
            </div>
            <Textarea
              rows={3}
              value={local.background}
              onChange={(e) => setLocal({ ...local, background: e.target.value })}
            />
          </div>
          <ChipList
            label='Interests'
            values={local.interests}
            onChange={(v) => setLocal({ ...local, interests: v })}
          />
          <ChipList
            label='Skills'
            values={local.skills}
            onChange={(v) => setLocal({ ...local, skills: v })}
          />
          <ChipList
            label='Constraints'
            values={local.constraints}
            onChange={(v) => setLocal({ ...local, constraints: v })}
          />
          <ChipList
            label='Goals'
            values={local.goals}
            onChange={(v) => setLocal({ ...local, goals: v })}
          />
        </div>

        <div className='border-t border-border mt-6 pt-4'>
          <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Redistill with guidance (optional)
          </div>
          <Input
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder='e.g., focus on the data analyst thread, ignore teaching'
          />
        </div>

        <div className='flex justify-end gap-2 mt-6'>
          <Button variant='outline' onClick={onCancel}>Cancel</Button>
          <Button
            variant='outline'
            disabled={!guidance.trim() || redistilling}
            onClick={() => {
              setRedistilling(true);
              onRedistill(guidance);
            }}
          >
            {redistilling ? 'Redistilling…' : 'Redistill'}
          </Button>
          <Button onClick={() => onAccept(local)}>Accept & generate</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire modal and distillation into `/chat`**

Replace `app/chat/page.tsx` with the fully wired version:
```tsx
'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore, type StudentProfile } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import PaperclipMenu from '@/components/chat/PaperclipMenu';
import ProfileReviewModal from '@/components/chat/ProfileReviewModal';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function ChatPage() {
  const router = useRouter();
  const store = useSessionStore();
  const messages = store.chatMessages;

  const [sending, setSending] = useState(false);
  const [paperclipOpen, setPaperclipOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProfile, setReviewProfile] = useState<StudentProfile | null>(null);
  const [reviewTrimmed, setReviewTrimmed] = useState(false);
  const [distilling, setDistilling] = useState(false);

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3 && !distilling;

  async function handleSend(text: string) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    store.addChatMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const llmConfig = await loadLLMConfig();
      const currentMessages = useSessionStore.getState().chatMessages;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          currentFocus: useSessionStore.getState().currentFocus,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Chat failed');
      }
      const { reply, trimmed } = (await res.json()) as {
        reply: string;
        trimmed: boolean;
      };
      if (trimmed) {
        store.addChatMessage({
          role: 'system',
          kind: 'notice',
          content:
            'Earlier messages were trimmed to fit — I still have your resume and recent context.',
        });
      }
      store.addChatMessage({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Chat failed');
      store.addChatMessage({
        role: 'assistant',
        content:
          "The advisor couldn't respond — check your provider settings and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  async function runDistillation(guidance?: string) {
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
          guidance,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Distillation failed');
      }
      const { profile, trimmed } = (await res.json()) as {
        profile: StudentProfile;
        trimmed: boolean;
      };
      setReviewProfile(profile);
      setReviewTrimmed(trimmed);
      setReviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Distillation failed');
    } finally {
      setDistilling(false);
    }
  }

  function handleAcceptProfile(profile: StudentProfile) {
    store.setDistilledProfile(profile);
    store.setCareers(null); // force regeneration
    setReviewOpen(false);
    router.push('/careers');
  }

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={() => runDistillation()}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <ChatComposer
        onSend={handleSend}
        onPaperclip={() => setPaperclipOpen(true)}
        disabled={sending}
      />
      <PaperclipMenu open={paperclipOpen} onClose={() => setPaperclipOpen(false)} />
      <ProfileReviewModal
        open={reviewOpen}
        profile={reviewProfile}
        trimmed={reviewTrimmed}
        onAccept={handleAcceptProfile}
        onRedistill={(g) => runDistillation(g)}
        onCancel={() => setReviewOpen(false)}
      />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- Visit `/chat`, have a short conversation (≥3 user messages).
- Click "Generate careers from this chat →" → review modal appears with a populated profile.
- Edit an interest/skill chip → click "Accept & generate" → navigates to `/careers` and generates.
- Return to chat, click the button again, enter guidance, click "Redistill" → profile updates.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add components/chat/ProfileReviewModal.tsx app/chat/page.tsx
git commit -m "Add profile review modal and wire chat-to-careers pipeline"
```

---

## Task 21: Stale focus clearing on regeneration

**Files:**
- Modify: `app/careers/page.tsx`

When the store receives new careers and the previous `currentFocus` is no longer present in the new set, clear focus and insert a marker.

- [ ] **Step 1: Add stale-focus effect**

At the top of `app/careers/page.tsx`, inside the `CareersPage` component body, add a new effect after the existing "Sync ReactFlow nodes" effect:
```tsx
// Clear focus if the focused career is no longer in the new set.
useEffect(() => {
  if (!careers) return;
  const focus = useSessionStore.getState().currentFocus;
  if (!focus) return;
  const stillPresent = careers.some((c) => c.jobTitle === focus);
  if (!stillPresent) {
    useSessionStore.getState().setFocus(null);
    useSessionStore.getState().addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: '— focus cleared, new careers generated —',
    });
  }
}, [careers]);
```

- [ ] **Step 2: Manual smoke test**

Focus on a card → chat a bit → regenerate careers (via "Generate careers from this chat") → when the resulting set doesn't include that title, confirm the focus chip disappears on return to `/chat` and a marker has been inserted.

- [ ] **Step 3: Commit**

```bash
git add app/careers/page.tsx
git commit -m "Clear stale focus when careers regenerate"
```

---

## Task 22: Full manual QA and type-check

**Files:** none.

- [ ] **Step 1: Run type-check**

Run: `npx tsc --noEmit`
Expected: No new errors vs. main. If any appear, fix them.

- [ ] **Step 2: Run full test suite**

Run: `npm run test`
Expected: All tests PASS (session-store, careers prompts, distill prompts, chat history).

- [ ] **Step 3: Run Electron dev build and walk the QA checklist**

Run: `npm run electron:dev`

Walk through this list, checking each item:

- [ ] Upload resume → spider graph renders
- [ ] Type free text only → spider graph renders
- [ ] Type job title only → spider graph renders with that title and variants
- [ ] Resume + text + title combined → graph renders
- [ ] Start chat → advisor responds in character
- [ ] Ask chat to write Python → politely refuses with redirect and tool suggestion
- [ ] Ask chat for homework help → politely refuses
- [ ] Paperclip resume mid-chat → attachment summary appears, advisor references it
- [ ] Paperclip text mid-chat → appears as user message
- [ ] Paperclip job title mid-chat → appears as user message and updates store
- [ ] Generate careers from chat → review modal shows editable profile
- [ ] Edit a profile field → accept → careers reflect the edit
- [ ] Redistill with guidance → profile updates
- [ ] From career card dialog, click "Chat about this" → focus chip + marker in same thread
- [ ] Clear focus via chip "×" → marker shows focus cleared
- [ ] Regenerate careers while focused on a now-absent career → focus auto-clears with marker
- [ ] Start over (chat top bar) → session clears, settings retained
- [ ] Start over (careers page) → session clears, settings retained

**Token-limit fallback** (manually simulate): temporarily throw a `new Error('maximum context length exceeded')` at the top of `app/api/chat/route.ts` inside the first `createCompletion` call path (or use a tiny model if available). Confirm the notice bubble appears. Revert the change.

- [ ] **Step 4: Stop the Electron dev instance**

- [ ] **Step 5: Commit (if any fix-ups were needed)**

If Step 3 surfaced bugs and you fixed them, commit each fix with a message like `Fix: <short description>`.

---

## Self-review — spec coverage check

| Spec requirement | Task(s) |
|---|---|
| Zustand session store with full shape | Tasks 2, 3 |
| Landing page two peer cards | Tasks 12, 13, 14 |
| Traditional card: resume + free text + job title | Task 12 |
| `getCareers` unified input shape | Tasks 4, 5 |
| Job-title-only framing in prompt | Task 4 |
| `/chat` page with top bar, message list, composer | Tasks 17, 18 |
| Advisor system prompt (B-with-warmth) | Task 7 |
| Focus chip + focus markers + focus-line injection | Tasks 7, 17, 16 |
| `/api/chat` route with trim fallback | Tasks 6, 8 |
| Paperclip menu with resume/text/title | Task 19 |
| `/api/distillProfile` route with trim fallback | Tasks 6, 9, 10 |
| Profile review modal (editable, redistill, accept) | Task 20 |
| Chat-to-careers pipeline wiring | Task 20 |
| `/careers` reads from session store | Task 15 |
| "Chat about this" action on career cards | Task 16 |
| Stale focus clearing | Task 21 |
| "Start over" action (header) | Tasks 15, 17 |
| Long-chat trim-and-retry (chat) | Tasks 6, 8 |
| Long-chat trim-and-retry (distillation) | Tasks 6, 10 |
| Unit tests: store, prompt builders, distill parser, trim helper | Tasks 2, 3, 4, 6, 9 |
| Manual QA checklist | Task 22 |

No gaps.
