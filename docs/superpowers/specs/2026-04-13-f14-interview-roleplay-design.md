# F14 — Interview Role-Play

**Date:** 2026-04-13
**Status:** Design approved — ready for implementation plan
**Phase reference:** Originally Phase 6 in `docs/phasing-proposal.md`. Cherry-picked to ship after Phase 2 because chat (Phase 1) and gap analysis / learning path (Phase 2) make interview practice the obvious next tool.
**Supersedes for F14:** the F14 description in `docs/feature-inventory.md`

---

## Summary

F14 ships a structured practice-interview surface for Career Compass. Students click "Practice interview" from the landing page, a career card, or any Phase 2 result page; pick a difficulty (friendly / standard / tough); and run a 5-phase mock interview with an interviewer-persona LLM. After the session ends, a separate LLM call generates structured feedback (strengths, prioritised improvements with example reframes, per-phase notes, next steps). The same scenario can be exported as a Talk Buddy JSON file at any point for voice rehearsal.

The feature lives at a new `/interview` route and reuses Phase 1's chat components (`ChatMessageList`, `ChatComposer`) and Phase 2's shared helpers (`isTokenLimitError`, `loadLLMConfig`, `CopyMarkdownButton`, `buildContextBlock`). It introduces no new top-level concept beyond what's already in the codebase — it's a chat with a different persona, an explicit phase counter, and a structured feedback output.

---

## Design principles (inherited, unchanged)

- No persistence beyond settings. Interview state lives in the session store, in-memory only.
- Export, don't save — the Markdown copy and the Talk Buddy scenario are the export paths.
- Privacy-first — local processing, the only network calls go to the LLM provider.
- Reuse before rebuild — Phase 1's chat UI, Phase 2's helpers, the existing context block all power the interview surface.

---

## Architecture

### Routes

- `/interview` — single page with three internal states:
  1. **Setup card** (default when no interview state exists)
  2. **Chat** (when `interviewMessages.length > 0` AND `interviewFeedback === null`)
  3. **Feedback** (when `interviewFeedback !== null`)

The page reads session state on mount and renders the appropriate state. There is no separate `/interview-feedback` route — feedback is a state of the same page so "Practice again" can reset and start fresh in place.

### Session store additions

New fields and types in `lib/session-store.ts`:

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

New fields on `SessionState`:

```ts
  // Interview
  interviewMessages: ChatMessage[];
  interviewTarget: string | null;
  interviewDifficulty: InterviewDifficulty;
  interviewPhase: InterviewPhase | null;
  interviewTurnInPhase: number;
  interviewFeedback: InterviewFeedback | null;
```

New actions:

```ts
  setInterviewSession: (target: string, difficulty: InterviewDifficulty) => void;
  addInterviewMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'kind'> & Partial<Pick<ChatMessage, 'id' | 'timestamp' | 'kind'>>) => void;
  advanceInterviewPhase: (phase: InterviewPhase | null, turnInPhase: number) => void;
  setInterviewDifficulty: (d: InterviewDifficulty) => void;
  setInterviewTarget: (t: string | null) => void;
  setInterviewFeedback: (f: InterviewFeedback | null) => void;
  resetInterview: () => void;
```

`setInterviewSession(target, difficulty)` clears any previous interview state and primes a new session: sets target, difficulty, `interviewMessages = []`, `interviewPhase = 'warm-up'`, `interviewTurnInPhase = 0`, `interviewFeedback = null`.

`resetInterview()` clears all interview fields back to their defaults but does NOT touch the rest of the store. Used by "Reconfigure" and "Practice again."

`reset()` (the existing global reset) is updated to also clear all interview fields, alongside the existing Phase 1 / Phase 2 fields.

### New API routes

- `app/api/interview/route.ts` — per-turn interviewer endpoint
- `app/api/interviewFeedback/route.ts` — one-shot feedback generator

Both follow the thin-wrapper pattern from Phase 1 / Phase 2: parse request, build prompt via a pure helper, call the LLM provider via the existing abstraction, parse the response, return JSON, with token-limit trim-and-retry.

### New pure modules

| Path | Responsibility |
|---|---|
| `lib/interview-phases.ts` | Phase ordering, `PHASE_CONFIG` constants, `nextPhase(current, turnInPhase)` advancement helper |
| `lib/prompts/interview.ts` | `buildInterviewSystemPrompt(input)` — per-turn system prompt with phase + difficulty + turn awareness |
| `lib/prompts/interview-feedback.ts` | `buildFeedbackPrompt(input)` and `parseFeedback(raw)` — one-shot feedback generation |
| `lib/talk-buddy-export.ts` | `buildTalkBuddyScenario(target, difficulty)` — pure function that returns `{ filename, json }` matching Talk Buddy's `Scenario` shape |
| `lib/download.ts` | `downloadJsonFile(filename, json)` — small browser helper for triggering a download |
| `lib/context-block.ts` | Extracted from `app/api/chat/route.ts`. `buildContextBlock(resumeText, freeText, jobTitle, jobAdvert)` — shared between chat and interview routes |

### Modified pure modules

| Path | Change |
|---|---|
| `lib/session-store.ts` | New types, fields, actions per above |
| `lib/markdown-export.ts` | Add `interviewFeedbackToMarkdown(f)` |
| `app/api/chat/route.ts` | Replace inline `buildContextBlock` with import from `lib/context-block.ts`. No behaviour change. |

### New components

| Path | Responsibility |
|---|---|
| `app/interview/page.tsx` | Orchestrator. Reads store, renders setup card / chat / feedback based on state. |
| `components/interview/InterviewSetupCard.tsx` | Pre-start form: target, difficulty radio, info note, three buttons. |
| `components/interview/InterviewChat.tsx` | Top bar (target chip, difficulty chip, phase progress, End interview, Reconfigure) + reused `ChatMessageList` + reused `ChatComposer`. |
| `components/interview/InterviewPhaseProgress.tsx` | Five small dots showing phase progress with hover tooltips. |
| `components/interview/InterviewFeedbackView.tsx` | Top-level feedback panel with rating, summary, strengths, collapsible improvements, per-phase notes, next steps, action buttons. |
| `components/interview/InterviewImprovementItem.tsx` | Collapsible improvement row showing `area` + expandable `why` and `example`. |

### Modified components

| Path | Change |
|---|---|
| `components/landing/ActionsZone.tsx` | Add 5th action button "Practice interview" with inline missing-input prompting (target required) |
| `components/landing/OutputsBanner.tsx` | Add "interview in progress" and "interview feedback ready" labels with quick-jump links to `/interview` |
| `components/CareerNode.tsx` | Add 4th button "Practice interview for this role" in the dialog footer alongside Phase 1's "Chat about this" and Phase 2's gap / learning path shortcuts |
| `components/results/GapAnalysisView.tsx` | Add "Practice interview for this target →" chain button alongside the existing "Turn this into a learning path →" |
| `components/results/LearningPathView.tsx` | Add "Practice interview for this target →" chain button alongside the existing "Run gap analysis for this target →" |
| `components/chat/ChatComposer.tsx` | Make `onPaperclip` prop optional. Hide the paperclip button when undefined. |

---

## Entry Points and Setup Card

### Entry points

Five paths to `/interview`, all converging on the setup card unless an interview is already in progress:

1. **`ActionsZone` "Practice interview" button.** Pre-flight check: needs `jobAdvert OR jobTitle`. If missing, inline highlight on Job title and Job advert with the message *"Practice interview needs a job. Paste a job advert or enter a job title."* (Same pattern as Phase 2 actions — never grey-disabled.)
2. **`CareerNode` "Practice interview for this role" button.** Sets `jobTitle` to the career name, navigates to `/interview`. No API call from the career card itself.
3. **`GapAnalysisView` "Practice interview for this target →" chain button.** Same row as the existing "Turn this into a learning path →".
4. **`LearningPathView` "Practice interview for this target →" chain button.** Same row as the existing "Run gap analysis for this target →".
5. **Direct navigation** to `/interview` (reload, browser back, OutputsBanner link). The page reads the store and renders the appropriate state.

### `InterviewSetupCard` layout

A centered max-w-2xl panel inside `/interview`, shown when no interview is in progress and no feedback exists. No LLM call has fired yet at this point.

```
PRACTICE INTERVIEW

Target role
  [Data Analyst                                    ]
  Pre-filled from your inputs. Edit if you want a different role.

Difficulty
  ( ) Friendly  Encouraging tone, gentle follow-ups
  (•) Standard  Realistic first-round phone screen
  ( ) Tough     Pointed questions, expects clear answers

About this session
  Around 7 questions across 5 phases (warm-up, behavioural,
  role-specific, your questions, wrap-up). Roughly 10-15 minutes.
  Your transcript stays on this device.

[← Back]   [Export to Talk Buddy]   [Begin interview →]
```

**Behaviour:**

- **Target field** pre-fills from `store.jobAdvert` (truncated to first line if long) or `store.jobTitle`. Editable; on edit writes to `store.jobTitle`.
- **Difficulty radio** binds to `store.interviewDifficulty`, defaulting to `standard`. Selection persists across navigation.
- **Back button** navigates to `/`. Doesn't clear anything.
- **Export to Talk Buddy** calls `buildTalkBuddyScenario(target, difficulty)` and `downloadJsonFile(filename, json)`. Toasts *"Scenario downloaded. Open Talk Buddy and use Upload."* Tooltip: *"Save as a Talk Buddy scenario for voice practice. Talk Buddy starts fresh each time — only the scenario is exported, not your transcript."*
- **Begin interview** validates target is non-empty (highlights inline if not), then:
  1. Validate target, ensure provider via `isLLMConfigured()` (toast + redirect to `/settings` if false), call `loadLLMConfig()`
  2. Set a local `starting` state on the button
  3. Post to `/api/interview` with `phase: 'warm-up'`, `turnInPhase: 0`, `messages: []`, target, difficulty, full context (resume / freeText / jobTitle / jobAdvert / distilledProfile), and the LLM config
  4. On success: `setInterviewSession(target, difficulty)`, then `addInterviewMessage(assistant reply)`, then `advanceInterviewPhase(reply.nextPhase, reply.nextTurnInPhase)`. The page transitions to the chat view because `interviewMessages.length > 0`.
  5. On failure: clear `starting`, toast. The session store is untouched.

Deferring `setInterviewSession` until after the first reply succeeds means a failed first call leaves the store clean — the student can retry from the setup card without any half-initialised state to clear.

---

## Interview Chat (UI + Phase Mechanism + API Route)

### `InterviewChat` UI

Shown inside `/interview` when `interviewMessages.length > 0` and `interviewFeedback === null`.

```
[← Back to landing]      Practice interview · Data Analyst · Standard
                         ● ● ◐ ○ ○                  Reconfigure  [End interview]

  ┌─ messages list (scrolls) ─────────────────────────────────┐
  │                                                            │
  │  [interviewer] Hi, thanks for taking the time today...    │
  │                                                            │
  │                              [user] I'm a final-year...   │
  │                                                            │
  └────────────────────────────────────────────────────────────┘

  [type your answer...]                                     [send]
```

**Top bar:**

- `← Back to landing` — `router.push('/')`. State persists.
- Title: *"Practice interview · {target} · {difficultyLabel}"*
- `<InterviewPhaseProgress />` — five dots: filled = completed, half-filled = current, empty = upcoming. Hover tooltip shows the phase name.
- *Reconfigure* link — confirmation dialog *"Discard this interview and start over from the setup card?"*, then `resetInterview()` and the page renders the setup card again.
- *End interview* button — confirmation dialog *"End the interview now and get feedback?"*, then triggers feedback generation (see "Feedback" section below).

**Message list:** reuses `ChatMessageList` directly. Same prop shape (`messages: ChatMessage[]`). No code duplication.

**Composer:** reuses `ChatComposer` with `onPaperclip` omitted. The component is updated to accept an optional `onPaperclip` and hide the paperclip button when undefined. Attachments mid-interview don't make sense — the resume / about-you / job advert are already in the context block via the API route.

**Send flow:**

1. Append user message via `addInterviewMessage({ role: 'user', content })`
2. Set local `sending` state on the composer
3. Read latest snapshot from `useSessionStore.getState()`
4. Post to `/api/interview` with the full message history, phase, turnInPhase, target, difficulty, and the shared context fields
5. On success:
   - Append assistant reply via `addInterviewMessage`
   - Call `advanceInterviewPhase(nextPhase, nextTurnInPhase)`
   - If `isComplete === true`: automatically trigger feedback generation (see below)
6. On failure: toast *"The interviewer couldn't respond. Try sending again."* The user message stays in the store so retry just re-sends the latest history.

### Phase mechanism

`lib/interview-phases.ts`:

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

**Total interviewer turns:** 1 + 2 + 2 + 1 + 1 = 7. Plus student responses ≈ 14 messages. About 10-15 minutes.

The route owns advancement, not the model. The model receives the current phase + turnInPhase in its system prompt; the route computes `nextPhase()` after each call and returns the new values to the client.

### `lib/prompts/interview.ts`

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
TURN IN PHASE: ${turnInPhase + 1} of ${config.turnsPerPhase}

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

### `app/api/interview/route.ts`

```ts
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

interface InterviewResponse {
  reply: string;
  nextPhase: InterviewPhase | null;  // null when isComplete
  nextTurnInPhase: number;
  isComplete: boolean;
  trimmed: boolean;
}
```

**Flow:**

1. Validate `target` is non-empty (400 if not)
2. Build system prompt via `buildInterviewSystemPrompt({target, difficulty, phase, turnInPhase})`
3. Build context block via `buildContextBlock(resumeText, freeText, jobTitle, jobAdvert)` (extracted from chat route into `lib/context-block.ts`)
4. Compose provider messages: `[system: interviewer prompt, system: context block (if non-null), ...filtered messages]`. Filter is the same as chat: `kind === 'message'` only.
5. Call provider via the existing `getLLMProvider(llmConfig).createCompletion(...)` abstraction
6. On token-limit error: trim `jobAdvert` to first 4000 chars, retry. If still failing: trim `interviewMessages` to last 20 entries with system + context preserved, retry. If still failing: return 500 with the "interview too long" message.
7. Compute `next = nextPhase(phase, turnInPhase)`
8. Return `{ reply, nextPhase: next.phase, nextTurnInPhase: next.turnInPhase, isComplete: next.isComplete, trimmed }`

Diagnostic log on entry (same shape as the chat / gap / learning routes) to help debug context block and message count.

If the request includes `distilledProfile`, format it for the context block alongside the other inputs. (For now the context block helper takes individual strings; the route can format the profile into a readable string before calling. Or extend `buildContextBlock` to accept a `distilledProfile` parameter directly. The cleaner option is the latter — extend the helper. This is a small Phase 3 enhancement included in the task list.)

---

## Feedback (Generation + Display)

### Trigger paths

Two ways feedback fires:

1. **Auto-trigger after wrap-up.** `/api/interview` returns `isComplete: true` → client immediately calls `/api/interviewFeedback` without student action. Loading state on the chat view says *"Generating feedback..."*. On success, transition to feedback panel.
2. **Manual end via "End interview" button.** Confirmation dialog → call `/api/interviewFeedback` with whatever transcript exists. Same loading state, same transition.

In both cases: spinner → feedback panel replaces the chat view → `interviewFeedback` is set.

### `lib/prompts/interview-feedback.ts`

```ts
import type { ChatMessage, InterviewDifficulty, InterviewFeedback, InterviewPhase } from '@/lib/session-store';

export type FeedbackPromptInput = {
  target: string;
  difficulty: InterviewDifficulty;
  messages: ChatMessage[];
  reachedPhase: InterviewPhase | null;
};

export function buildFeedbackPrompt(input: FeedbackPromptInput): string;
export function parseFeedback(raw: string): InterviewFeedback;
```

The prompt asks for the structured `InterviewFeedback` JSON shape. Key instructions:

- *"You are giving feedback on a practice interview. Be honest but encouraging. The student is using this to improve, not to be graded."*
- *"Reference SPECIFIC moments from the transcript when giving feedback. Quote or paraphrase actual things they said."*
- *"For each improvement, include a concrete `example` field that REWRITES one of the student's actual answers using the technique you're suggesting. The example is the most valuable part — never skip it."*
- *"`overallRating` must be one of three: developing / on-track / strong. Use `developing` only if the student showed fundamental gaps. Use `on-track` for solid work with clear room to grow. Use `strong` only when the student is genuinely interview-ready for this level."*
- *"`nextSteps` should be 2-3 items maximum, ordered by priority. Pick things the student can do this week."*
- *"If the interview ended early (the student didn't reach all phases), acknowledge that in the summary and only give per-phase notes for phases they actually reached."*
- *"Never fabricate things the student didn't say. If you don't have enough information to evaluate a phase, say so honestly in the per-phase note."*

`parseFeedback` validates required fields, throws on missing `summary` or empty `improvements`, tolerates missing `perPhase` (coerced to empty array), coerces invalid `overallRating` to `'on-track'` as a safe default, and validates each improvement has `area`, `why`, `example`.

### `app/api/interviewFeedback/route.ts`

```ts
interface FeedbackRequest {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  reachedPhase: InterviewPhase | null;
  llmConfig?: LLMConfig;
}

interface FeedbackResponse {
  feedback: InterviewFeedback;
  trimmed: boolean;
}
```

Thin wrapper. Validates `target` is non-empty and `messages` contains at least one user message. Builds the prompt, calls the provider, parses, returns. Token-limit retry: trim transcript to last 30 messages and prepend a note to the prompt: *"This is the most recent portion of a longer transcript. Earlier messages were dropped to fit the token budget. Acknowledge this in your summary."*

### `InterviewFeedbackView` UI

Replaces the chat view inside `/interview` once `interviewFeedback !== null`. Same page, different state.

```
[← Back to landing]                    Practice interview · Data Analyst · Standard

INTERVIEW FEEDBACK
─────────────────────────────────────────────────────────

Overall: On track  ●●○

Summary
  <2-3 sentences>

What you did well ✓
  · Clear, structured intro
  · Strong specific example for the Python question
  · Asked a thoughtful question back

What to work on                                    [Show all details]
  ▸ [TOP] Use the STAR structure for behavioural answers
  ▸ Quantify your impact with numbers
  ▸ Slow down on technical explanations

By phase
  Warm-up         Confident and concise
  Behavioural     Stories were engaging but missing the "Result"
  Role-specific   Solid Python; SQL knowledge felt thinner
  Your questions  Asked one good question, could ask more
  Wrap-up         Polite and clear

Next steps
  1. Practice 3 STAR answers from your work history
  2. Brush up on SQL window functions
  3. Prepare 5 thoughtful questions to ask interviewers

──────────────────────────────────────────────────────────
[Copy as Markdown]  [Export to Talk Buddy]  [Practice again]  [Start over]
```

**`InterviewImprovementItem`** is the collapsible row component. Compact form shows just the priority marker (TOP for the first one) and the `area` text. Click expands to show `why` (1 sentence) and `example` (the rewritten version of one of the student's actual answers).

**Show all details toggle** expands every improvement at once, mirroring the Phase 2 GapAnalysisView pattern.

**Per-phase notes are not collapsible** — they're already short. Only phases the student reached are shown.

**Bottom-row buttons:**

- **Copy as Markdown** — reuses the shared `CopyMarkdownButton` with `getMarkdown={() => interviewFeedbackToMarkdown(feedback)}`. Always exports full detail regardless of UI expand state.
- **Export to Talk Buddy** — same handler as the setup card export, with the post-finish tooltip variant: *"Export this scenario to Talk Buddy for voice practice. Note: Talk Buddy starts fresh — your transcript and feedback don't transfer, only the role and difficulty."*
- **Practice again** — confirmation dialog *"Start a new interview for the same target and difficulty? Your current feedback will be cleared."* On confirm: read `target` and `difficulty` from the feedback object, call `resetInterview()`, then immediately `setInterviewSession(target, difficulty)` and call `/api/interview` for the first warm-up turn. Setup card is skipped — straight into a fresh chat.
- **Start over** — full session reset (`store.reset()`) and navigate to `/`. Confirms first.

### `interviewFeedbackToMarkdown` shape

```markdown
# Interview Feedback: Data Analyst

**Difficulty:** Standard
**Overall rating:** On track

<summary paragraph>

## What you did well
- Clear, structured intro
- Strong specific example for the Python question
- Asked a thoughtful question back

## What to work on

### 1. Use the STAR structure for behavioural answers
**Why it matters:** Behavioural questions reward concrete situation/action/result framing.
**Example reframe of your answer:**
> Instead of "I worked on a team project where we improved customer satisfaction" you could say "When our team's NPS dropped 15 points (Situation), I led a customer interview series with 12 users (Task & Action), and we identified 3 specific friction points that, once fixed, brought NPS back up by 22 points in two weeks (Result)."

### 2. Quantify your impact with numbers
...

## By phase
- **Warm-up:** Confident and concise
- **Behavioural:** Stories were engaging but missing the "Result"
- **Role-specific:** Solid Python; SQL knowledge felt thinner
- **Your questions:** Asked one good question, could ask more
- **Wrap-up:** Polite and clear

## Next steps
1. Practice 3 STAR answers from your work history
2. Brush up on SQL window functions
3. Prepare 5 thoughtful questions to ask interviewers

*AI-generated feedback. Treat as one perspective, not a verdict.*
```

---

## Talk Buddy Export

### `lib/talk-buddy-export.ts`

Pure function. No LLM call. Inputs: target string + difficulty enum. Output: `{ filename, json }`.

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

The exported system prompt is intentionally a flattened, self-contained version of the per-turn Career Compass prompt. Talk Buddy has no phase counter — its model has to walk the structure on its own from a single prompt. The duplication (~30 lines vs the per-turn version) is small and the two prompts serve different runtimes; trying to share would force one to be awkward.

### `lib/download.ts`

```ts
export function downloadJsonFile(filename: string, json: string): void {
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

### Where the buttons live

Two places, identical handler:

1. **`InterviewSetupCard`** — between `← Back` and `Begin interview →`. Tooltip: *"Save as a Talk Buddy scenario for voice practice. Talk Buddy starts fresh each time — only the scenario is exported, not your transcript."*
2. **`InterviewFeedbackView`** — alongside `Copy as Markdown`, `Practice again`, `Start over`. Tooltip: *"Export this scenario to Talk Buddy for voice practice. Note: Talk Buddy starts fresh — your transcript and feedback don't transfer, only the role and difficulty."*

Both buttons call `buildTalkBuddyScenario(target, difficulty)` then `downloadJsonFile(filename, json)`. Toast on success.

---

## Phase 1 / Phase 2 Integration

### 1. Entry buttons

Five entry points listed above (ActionsZone, CareerNode, GapAnalysisView, LearningPathView, direct nav). Each is one or two new buttons in an existing component.

### 2. `OutputsBanner` adds two new labels

```
You have:  6 careers · 3 chat messages · gap analysis ready · learning path ready · interview in progress · interview feedback ready
```

- **`interview in progress`** — visible when `interviewMessages.length > 0` AND `interviewFeedback === null`. Links to `/interview`.
- **`interview feedback ready`** — visible when `interviewFeedback !== null`. Links to `/interview`. Suppresses the "in progress" label.

### 3. `Start over` clears interview state

`store.reset()` is updated to clear `interviewMessages`, `interviewTarget`, `interviewDifficulty` (back to default), `interviewPhase`, `interviewTurnInPhase`, `interviewFeedback`. The `resetInterview()` action exists separately for "Practice again" and "Reconfigure" flows that should clear ONLY the interview state.

### 4. Reused components and helpers

- `ChatMessageList` — used as-is for `interviewMessages`
- `ChatComposer` — used as-is, with `onPaperclip` made optional and the paperclip button conditionally rendered
- `buildContextBlock` — extracted into `lib/context-block.ts` and shared between chat and interview routes (refactor)
- `isLLMConfigured`, `loadLLMConfig` — already shared
- `isTokenLimitError` — already shared
- `CopyMarkdownButton` — reused on the feedback panel

### 5. No nav changes

Header, Settings, About are not modified. The interview is reachable only via in-app actions.

---

## Error handling

**LLM provider failures.** Both new routes catch errors and return 500 with a message. UI surfaces them as toasts. Per-turn interview failures keep the user message in the store so retry re-sends the latest history. Feedback failures show a "Try again" button that re-runs the feedback call against the preserved transcript.

**Token limits.** Both routes use `lib/token-limit.ts`:

- **Interview route:** trim `jobAdvert` to first 4000 chars on first retry. If still failing: trim `interviewMessages` to last 20 entries with system + context preserved. If still failing: 500 with *"This interview has grown too long. End the interview now to see your feedback."*
- **Feedback route:** trim transcript to last 30 messages and prepend a truncation note to the prompt. If still failing: 500 with *"The transcript is too long to summarise. Try practising again with shorter answers."*

**Parse failures (feedback).** Throws inside `parseFeedback`, route returns 500. UI shows *"The AI returned something we couldn't read. Try again — sometimes a second attempt works."*

**Missing inputs at API layer.** `/api/interview` returns 400 if `target` is empty. `/api/interviewFeedback` returns 400 if `messages` is empty.

**No provider configured.** Same as Phase 1/2: `isLLMConfigured` check on the entry side (setup card "Begin interview" button). If false: toast and redirect to `/settings`.

**Mid-interview navigation.** Leaving `/interview` mid-session does not clear the interview. State persists in the session store. Returning to `/interview` resumes the same chat. This is consistent with Phase 1's chat behaviour.

**Reconfigure / Practice again destructive actions.** Both clear `interviewMessages` and require a confirmation dialog. *"Reconfigure"* says *"Discard this interview and start over from the setup card?"* and *"Practice again"* says *"Start a new interview for the same target and difficulty? Your current feedback will be cleared."*

---

## Testing

### Unit tests (Vitest)

- **`lib/session-store.test.ts`** — extend with: `setInterviewSession`, `addInterviewMessage`, `advanceInterviewPhase`, `setInterviewFeedback`, `resetInterview`, and `reset()` clearing all interview fields.
- **`lib/interview-phases.test.ts`** — `nextPhase()` correctness across all transitions:
  - warm-up → behavioural after 1 turn
  - behavioural → role-specific after 2 turns
  - role-specific → your-questions after 2 turns
  - your-questions → wrap-up after 1 turn
  - wrap-up → null with `isComplete: true` after 1 turn
  - mid-phase advancement increments turnInPhase without changing phase
- **`lib/prompts/interview.test.ts`** — `buildInterviewSystemPrompt`:
  - Includes target name, difficulty tone (different per level), phase name, phase guidance, turn counter
- **`lib/prompts/interview-feedback.test.ts`** — `buildFeedbackPrompt` and `parseFeedback`:
  - Build: transcript included, target and difficulty included, partial-interview note appears when `reachedPhase` isn't `wrap-up`
  - Parse happy path
  - Parse strips markdown code fences
  - Parse coerces missing `perPhase` to empty array
  - Parse throws on missing `summary` or empty `improvements`
  - Parse coerces invalid `overallRating` to `'on-track'`
  - Each improvement preserves `area`, `why`, `example`
- **`lib/talk-buddy-export.test.ts`** — difficulty mapping, slugified filename, prompt content includes target and 5 phase labels, JSON parses back to the expected shape, estimated minutes is reasonable.
- **`lib/markdown-export.test.ts`** — extend with `interviewFeedbackToMarkdown` snapshot tests.
- **`lib/context-block.test.ts`** — new file covering the extracted helper. Tests for each combination of inputs, the disambiguation hint, the empty-input case returning null.

### Manual QA checklist

- [ ] Landing: ActionsZone shows 5 buttons. Click "Practice interview" with no target → inline highlight on Job title and Job advert
- [ ] Add a job title, click "Practice interview" → navigates to `/interview`, setup card with target pre-filled
- [ ] Setup card: change difficulty to Tough → store updates, persists if you go Back and return
- [ ] Setup card: edit target field → store updates
- [ ] Setup card: click "Export to Talk Buddy" → JSON file downloads, name is `mock-interview-{slug}.json`, opens in Talk Buddy via Upload, scenario appears
- [ ] Setup card: click "Begin interview" → first interviewer message appears within a few seconds, setup card disappears, chat surface shows
- [ ] Chat: top bar shows target chip, difficulty chip, 5 phase dots, Reconfigure link, End interview button
- [ ] Chat: send a response → interviewer replies, phase dots advance correctly
- [ ] Chat: complete all 5 phases → wrap-up message → auto-trigger feedback → feedback panel renders
- [ ] Chat: click End interview mid-session → confirmation → feedback generates from partial transcript → feedback panel acknowledges incomplete session
- [ ] Chat: click Reconfigure mid-session → confirmation → setup card reappears with previous target and difficulty preserved
- [ ] Feedback: rating dot indicator visible, summary, strengths, improvements compact
- [ ] Feedback: click an improvement row → expands to show why and example
- [ ] Feedback: click "Show all details" → all improvements expand
- [ ] Feedback: per-phase notes visible (only for phases reached)
- [ ] Feedback: next steps numbered and ordered
- [ ] Feedback: Copy as Markdown → paste into notes app, verify full content with example reframes
- [ ] Feedback: Export to Talk Buddy → same JSON as setup card export (no transcript / feedback baked in)
- [ ] Feedback: Practice again → confirmation → fresh chat starts with same target and difficulty (setup card skipped)
- [ ] Feedback: Start over → confirmation → store fully reset → returns to landing
- [ ] Career card: click "Practice interview for this role" → navigates with target pre-filled
- [ ] Gap analysis page: click "Practice interview for this target →" → navigates correctly
- [ ] Learning path page: click "Practice interview for this target →" → navigates correctly
- [ ] OutputsBanner: while interview is in progress, "interview in progress" label appears with link to `/interview`
- [ ] OutputsBanner: after feedback generated, "interview feedback ready" appears, "in progress" disappears
- [ ] Navigate away from `/interview` mid-session → return → exact same state restored
- [ ] Navigate away after feedback → return → feedback panel still visible
- [ ] Reload Electron mid-interview (Cmd+R) → state lost (in-memory only — expected)
- [ ] Resume / about-you / job advert all show up in interviewer's questions (referenced by name)
- [ ] Tough difficulty visibly probes harder than Friendly
- [ ] Token-limit error simulation on a huge job advert → trim retry triggers
- [ ] Force a parse error on the feedback route → toast + retry button
- [ ] Electron dev build works end to end (`npm run electron:dev`)

### Not testing in F14

- Actual feedback quality (subjective; manual review)
- Voice rendering in Talk Buddy after import (Talk Buddy's responsibility)
- Long interview behaviour past the trim-and-retry fallback
- Interview persistence across app restarts (never — violates principle)

---

## Scope & non-goals

### In scope

- New session store fields, types, and actions for the interview
- `lib/interview-phases.ts` — phase config and `nextPhase()` helper, with tests
- `lib/prompts/interview.ts` — interviewer system prompt builder
- `lib/prompts/interview-feedback.ts` — feedback prompt builder + parser
- `lib/context-block.ts` — extract from chat route into shared helper, with tests
- `lib/talk-buddy-export.ts` — pure scenario builder, with tests
- `lib/download.ts` — `downloadJsonFile` browser helper
- `lib/markdown-export.ts` — extend with `interviewFeedbackToMarkdown`
- `app/api/interview/route.ts` — per-turn interviewer endpoint
- `app/api/interviewFeedback/route.ts` — feedback generation endpoint
- `app/interview/page.tsx` — orchestrator: setup card / chat / feedback
- `components/interview/InterviewSetupCard.tsx`
- `components/interview/InterviewChat.tsx` (top bar + reused message list + reused composer)
- `components/interview/InterviewPhaseProgress.tsx` (5 dots)
- `components/interview/InterviewFeedbackView.tsx`
- `components/interview/InterviewImprovementItem.tsx`
- `ChatComposer` — make `onPaperclip` optional, hide paperclip button when undefined
- Career card "Practice interview for this role" button
- `GapAnalysisView` and `LearningPathView` — add "Practice interview for this target →" chain button
- `ActionsZone` — add 5th "Practice interview" action with missing-input prompting
- `OutputsBanner` — add interview-in-progress and interview-feedback-ready labels
- Refactor: extract `buildContextBlock` from `app/api/chat/route.ts` into `lib/context-block.ts` and update both routes to import from it. Extend it to optionally accept a `distilledProfile`.

### Explicitly out of scope (deferred)

| Deferred | Target |
|---|---|
| Voice rendering of the interview in Career Compass | Never — by design (voice is Talk Buddy's job) |
| Search-grounded role-specific questions (real interview questions for the named company) | Future phase (web search) |
| Multiple interviewer personas (HR / hiring manager / panel) | Later if there's demand |
| Stress / curveball difficulty level | Out of scope (mental health concern for ESL students) |
| Interview history / previous attempts comparison | Never — violates "no persistence" principle |
| Real-time coaching mid-interview (whisper hints) | Out of scope; would change the practice dynamic |
| Audio transcription / dictation in the composer | Out of scope; voice belongs in Talk Buddy |
| Interview question banks pre-loaded by industry | Out of scope; LLM generates on demand |
| PDF export of feedback | Future export work |
| Sharing feedback to a mentor / coach via link | Out of scope; offline-first principle |

### Carry-forward notes

- A future web-search phase will retroactively upgrade interview quality by letting the role-specific phase reference real current interview questions for the target company / industry.
- The two-prompt interview architecture (interviewer prompt + feedback prompt) is reusable for any future "structured practice" feature (e.g., presentation rehearsal, viva voce practice).
- The `lib/context-block.ts` extraction is a small refactor that pays off again in any future feature that needs the same student context block.

---

## Open questions

None blocking. Resolved during brainstorming and captured above:

- Integration model → separate `/interview` route, not a mode in `/chat`
- Entry points → landing button + career card shortcut + gap/learning chain buttons
- Interview structure → 5 phases with deterministic turn counts (warm-up=1, behavioural=2, role-specific=2, your-questions=1, wrap-up=1)
- Difficulty knob → 3 levels (friendly / standard / tough), default standard
- Setup card → required preamble before every interview, with editable target + difficulty + Talk Buddy export
- Phase advancement → route-tracked, not model-tracked
- Context sharing → reuse `buildContextBlock` (extracted into a shared helper)
- Feedback shape → structured JSON with summary, strengths, improvements (with example reframes), per-phase notes, 3-level overall rating, ordered next steps
- Feedback rendering → same `/interview` page, replaces chat view
- Talk Buddy export → both setup card AND feedback panel, with honest "transcript doesn't transfer" tooltip
- Practice again → skips setup card, runs same target and difficulty
