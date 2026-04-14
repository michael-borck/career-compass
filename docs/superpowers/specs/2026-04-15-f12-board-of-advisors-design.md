# F12 — Board of Advisors

**Date:** 2026-04-15
**Status:** Design approved — ready for implementation plan
**Phase reference:** Originally Phase 4 in `docs/phasing-proposal.md`. Shipping F12 after F11, ahead of F10.

---

## Summary

F12 ships a Board of Advisors reviewer. Four named personas — The Recruiter, The HR Partner, The Hiring Manager, and The Mentor — each read the student's profile and share what they notice. The four voices are produced in a single LLM call and followed by a board-level synthesis highlighting where they agreed, where they pushed back on each other, and 2-3 things to work on.

The pedagogical value is watching credible voices disagree. A student who only ever heard one career opinion at a time learns that career advice isn't monolithic — the Recruiter's "resume ATS concerns" can sit next to the Mentor's "this shows intellectual curiosity" and both can be true. The synthesis pulls the lesson out for students who scan.

The feature lives at a new `/board` route and reuses the existing input plumbing (resume / about you / job title / job advert / distilled profile). No grounding — this is voiced reflection, not market research.

---

## Design principles (inherited, unchanged)

- No persistence beyond settings. Board state lives in the session store, in-memory only.
- Privacy-first. No new outbound traffic. No grounding.
- Export, don't save. Copy as Markdown renders the whole board + synthesis into a portable document.
- Reuse before rebuild. The existing `/api/distillProfile` handles the chat chain framing. Existing `CopyMarkdownButton`, `.editorial-rule` CSS, Studio Calm tokens all apply.
- Four-advisor panel is fixed. Students don't pick personas; the value is in the consistency and the disagreement, not curation.

---

## Architecture

### Routes

- `app/board/page.tsx` — single page with two internal views:
  1. **Input view** (default when `boardReview` is null) — `BoardInputCard` with framing + optional focus role + convene button
  2. **Review view** (when `boardReview` exists) — framing echo + `BoardVoices` + `BoardSynthesisPanel`

No toggle needed — view is driven purely by whether a review exists in the session store.

### Session store additions

New types in `lib/session-store.ts`:

```ts
export type BoardAdvisorRole = 'recruiter' | 'hr' | 'manager' | 'mentor';

export type BoardAdvisorVoice = {
  role: BoardAdvisorRole;
  name: string;      // e.g. "The Recruiter"
  response: string;  // free-form paragraph in character
};

export type BoardSynthesis = {
  agreements: string[];    // where the board converged
  disagreements: string[]; // where they pushed back on each other
  topPriorities: string[]; // 2-3 things to work on
};

export type BoardReview = {
  framing: string;           // what student asked the board to focus on (may be empty)
  focusRole: string | null;  // optional target role
  voices: BoardAdvisorVoice[];
  synthesis: BoardSynthesis;
};

export type BoardPrefill = {
  framing?: string;
  focusRole?: string;
};
```

New fields on `SessionState`:

```ts
boardReview: BoardReview | null;
boardPrefill: BoardPrefill | null;
```

`boardPrefill` is a **read-and-clear transient** — pages that navigate to `/board` with pre-filled inputs write it before navigating, and the board page reads it on mount and immediately clears it. This pattern survives navigation without persisting across later visits to `/board`. Carry-forward pattern for F10.

New actions:

```ts
setBoardReview: (r: BoardReview | null) => void;
setBoardPrefill: (p: BoardPrefill | null) => void;
consumeBoardPrefill: () => BoardPrefill | null; // reads and clears atomically
```

`reset()` clears both fields automatically via `set({ ...initialState })`.

### New API route

- `app/api/board/route.ts` — thin wrapper. Accepts `{ framing, focusRole, resume?, freeText?, jobTitle?, jobAdvert?, distilledProfile?, llmConfig? }`. Calls LLM with the board prompt. Returns `{ review, trimmed }`. Trim-retry on token limits: advert → resume → 500.

### New pure modules

| Path | Responsibility |
|---|---|
| `lib/prompts/board.ts` | `buildBoardPrompt(input)` + `parseBoardReview(raw)` |
| `lib/prompts/board.test.ts` | Unit tests |

### Modified modules

- `lib/session-store.ts` — new types, fields, actions
- `lib/session-store.test.ts` — extended tests
- `lib/markdown-export.ts` — add `boardReviewToMarkdown`
- `lib/markdown-export.test.ts` — extended tests
- `components/landing/ActionsZone.tsx` — add "Board of advisors" button to Reflect group (alongside "Imagine three lives")
- `components/landing/OutputsBanner.tsx` — add "board review ready" quick-jump link
- `components/chat/ChatComposer.tsx` — optional `onBoard?: () => void` prop + chain button
- `app/chat/page.tsx` — `handleBoard` handler reusing `/api/distillProfile` with custom guidance
- `components/CareerNode.tsx` — add "Ask the board about this role" shortcut button that writes `boardPrefill.focusRole` and navigates to `/board`

### New components

- `app/board/page.tsx` — orchestrator. Reads `boardReview` from store, renders input view or review view based on presence.
- `components/board/BoardInputCard.tsx` — framing textarea + optional focus role input + convene button + profile summary strip.
- `components/board/BoardVoices.tsx` — receives `voices: BoardAdvisorVoice[]`, renders four stacked cards in fixed order (`recruiter / hr / manager / mentor`) with one-line role taglines.
- `components/board/BoardSynthesisPanel.tsx` — renders `agreements` / `disagreements` / `topPriorities` sections.

---

## Input UI

The default `/board` view when `boardReview` is null:

```
[← Back]                                              [Start over]

────── Board of advisors ──────
Four perspectives on your profile

A recruiter, an HR partner, a hiring manager, and a mentor will
each read your profile and share what they notice. They won't
always agree — that's the point.

┌─ What's on your mind? (optional) ───────────────────────┐
│ [4-row textarea, placeholder example:                    │
│  "I'm worried my degree feels too academic for industry │
│  data roles."]                                           │
└──────────────────────────────────────────────────────────┘

┌─ A specific role to centre on? (optional) ─────────────┐
│ [single-line input, placeholder "Graduate data analyst"]│
└──────────────────────────────────────────────────────────┘

Your profile (from the landing inputs)
  · Resume: resume.pdf  ·  About you: 2 paragraphs  ·  Distilled profile: yes

[Convene the board]
```

### Input wiring

- **Framing textarea** — local React state, initialised from `consumeBoardPrefill().framing` on mount. 4 rows, optional, placeholder shows an example. Never written to session store until after the board runs (then only `boardReview.framing` holds the echoed value).
- **Focus role input** — same pattern. Local state, initialised from `consumeBoardPrefill().focusRole`.
- **Profile summary strip** — reads from session store and labels what material the board will see. Shows one of: `Resume: <filename>`, `About you: <N paragraphs>`, `Distilled profile: yes`, `Job title: <title>`. Hides rows that don't apply.
- **Convene button** — primary. Disabled if no profile material at all (`!resumeText && !freeText.trim() && !distilledProfile`). Pre-flight `isLLMConfigured()` check; redirects to `/settings` with a toast if not. Runs a local `convening` spinner state. On success: `store.setBoardReview(review)`. On failure: toast, input card stays populated.
- **No profile material helper** — when the button is disabled, show inline: *"The board needs at least a resume, an About you, or a distilled profile to review. Add one on the landing page."*

### Pre-fill paths

- **Landing Reflect group "Board of advisors"** — navigates to `/board`. No pre-fill (`boardPrefill` stays null).
- **Career card "Ask the board about this role"** — writes `boardPrefill = { focusRole: career.jobTitle }`, navigates to `/board`. Focus field pre-filled, framing empty.
- **Chat chain "Try as board review →"** — calls `/api/distillProfile` with custom guidance (see Chat chain section), writes `boardPrefill = { framing: <one-sentence summary> }`, navigates to `/board`. Framing field pre-filled, focus empty.

Because `boardPrefill` is read-and-clear on mount, a second visit to `/board` (via back button, nav, etc.) does NOT re-apply the pre-fill — the student sees whatever they last typed, or an empty form.

---

## The board prompt

### `lib/prompts/board.ts`

```ts
import type { StudentProfile, BoardAdvisorVoice, BoardSynthesis } from '@/lib/session-store';

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

export function buildBoardPrompt(input: BoardInput): string;
export function parseBoardReview(raw: string): ParsedBoard;
```

### Prompt body

> You are running a Board of Advisors review for a student. Four advisors each read the student's profile and share what they notice. The advisors have different personalities and will not always agree — that's the point.
>
> **Advisor 1 — The Recruiter.** Market-facing. Thinks about how this profile would land in an applicant tracking system and a recruiter's 30-second scan. Cares about keywords, positioning, resume format, and market signal. Direct and pragmatic.
>
> **Advisor 2 — The HR Partner.** Thinks about culture fit, soft-skill signals, red flags, and what references would likely say. Reads between the lines. Thoughtful, careful tone.
>
> **Advisor 3 — The Hiring Manager.** Thinks about whether they'd bet their team on this person. Cares about evidence of impact, problem-solving stories, and what they'd probe in an interview. Skeptical but fair.
>
> **Advisor 4 — The Mentor.** A warm but honest career coach. Counterbalances the first three without sugar-coating. Names strengths the others might miss and suggests low-risk experiments. Encouraging but never dishonest.
>
> Respond with JSON in EXACTLY this shape (no prose, no code fences):
>
> ```
> {
>   "voices": [
>     { "role": "recruiter", "name": "The Recruiter", "response": string (2-4 sentences in character) },
>     { "role": "hr", "name": "The HR Partner", "response": string (2-4 sentences in character) },
>     { "role": "manager", "name": "The Hiring Manager", "response": string (2-4 sentences in character) },
>     { "role": "mentor", "name": "The Mentor", "response": string (2-4 sentences in character) }
>   ],
>   "synthesis": {
>     "agreements": string[] (2-4 points where the board converged),
>     "disagreements": string[] (1-3 points where advisors pushed back on each other — be specific about which advisor said what, e.g. "The Recruiter thought X, but The Mentor argued Y."),
>     "topPriorities": string[] (2-3 things to work on, ordered most important first)
>   }
> }
> ```
>
> Make the disagreements real. If the recruiter sees a weakness the mentor sees as a strength, name both sides. Students learn more from watching credible voices disagree than from a unified verdict.
>
> `<framing>{framing}</framing>` (omitted if empty)
> `<focusRole>{focusRole}</focusRole>` (omitted if null)
> `<profile>{resume + aboutYou + distilledProfile + jobAdvert sections}</profile>`
>
> ONLY respond with JSON. No prose, no code fences.

### Parser

`parseBoardReview(raw)` validates:

- Strips markdown code fences.
- `voices` is an array. Coerces to canonical order `['recruiter','hr','manager','mentor']`.
- Throws if any of the four roles is missing.
- Throws if any voice has an empty `response`.
- `synthesis.agreements`, `synthesis.disagreements`, `synthesis.topPriorities` — each coerces missing/non-array to `[]`.
- Throws if all three synthesis arrays are empty (better a hard fail than a useless review).
- Trims strings.

Temperature ~0.7 for personality. Gap analysis uses 0.4, odyssey uses 0.4 — this one deliberately higher.

### API route — trim-retry

`app/api/board/route.ts`:

1. Validates at least one of `resume / freeText / distilledProfile` is present (400 otherwise).
2. Builds prompt with full context.
3. On token limit: trim `jobAdvert` to 4000 chars, retry.
4. On token limit: trim `resume` to 4000 chars, retry.
5. On token limit after both trims: 500 with *"This profile is too long for the board to review. Try trimming your resume or about you."*
6. Parses response. On parse throw: 500 with the error message surfaced.

Returns `{ review: { framing, focusRole, voices, synthesis }, trimmed }` on success.

---

## Review UI

After the board runs, `/board` renders:

```
[← Back]   Board review                      [Copy as Markdown] [Run again] [Start over]

────── Board of advisors ──────
Four perspectives on your profile

Your framing: <framing>            (omitted if empty)
Focus role: <focusRole>            (omitted if null)

┌─ The Recruiter ─────────────────────────────────────────┐
│ Market-facing, keyword-scanning                          │
│                                                           │
│ <response paragraph>                                      │
└──────────────────────────────────────────────────────────┘

┌─ The HR Partner ────────────────────────────────────────┐
│ Culture & soft-signal reader                             │
│                                                           │
│ <response paragraph>                                      │
└──────────────────────────────────────────────────────────┘

┌─ The Hiring Manager ────────────────────────────────────┐
│ Would they bet their team on you                         │
│                                                           │
│ <response paragraph>                                      │
└──────────────────────────────────────────────────────────┘

┌─ The Mentor ────────────────────────────────────────────┐
│ Warm but honest coach                                    │
│                                                           │
│ <response paragraph>                                      │
└──────────────────────────────────────────────────────────┘

────── Where the board landed ──────

Where they agreed
  · point
  · point

Where they pushed back on each other
  · "The Recruiter thought X, but The Mentor argued Y."
  · ...

What to work on
  1. priority
  2. priority
  3. priority

*Four AI-generated perspectives. Disagreement is part of the exercise.*
```

### `BoardVoices` component

- Receives `voices: BoardAdvisorVoice[]` (already in canonical order).
- Renders four stacked cards.
- Each card: `border border-border rounded-lg bg-paper p-5` with `border-l-4 border-accent/50` stripe.
- Card header: `h3` with the advisor's `name` and a one-line tagline below (fixed per role, rendered from a local constant map, not from the LLM).
- Card body: `response` as a paragraph.

Fixed tagline map:

```ts
const TAGLINES: Record<BoardAdvisorRole, string> = {
  recruiter: 'Market-facing, keyword-scanning',
  hr: 'Culture and soft-signal reader',
  manager: 'Would they bet their team on you',
  mentor: 'Warm but honest coach',
};
```

### `BoardSynthesisPanel` component

- Receives `synthesis: BoardSynthesis`.
- Wrapped in `.editorial-rule.justify-center` header: *"Where the board landed"*.
- Three sub-sections, each with an `h3`:
  - *Where they agreed* — bulleted list
  - *Where they pushed back on each other* — bulleted list
  - *What to work on* — numbered list
- Hides sub-sections with empty arrays (but at least one must be present — the parser guarantees this).
- Footer: *"Four AI-generated perspectives. Disagreement is part of the exercise."* in `text-ink-quiet` italic.

### Orchestrator buttons

- **Copy as Markdown** — always visible when a review exists. Uses shared `CopyMarkdownButton` with `getMarkdown={() => boardReviewToMarkdown(boardReview)}`.
- **Run again** — clears `boardReview` via `setBoardReview(null)`, but also writes the previous framing + focus into `boardPrefill` before clearing so the student returns to the input view with both fields pre-filled. Confirmation dialog: *"Run the board again? The current review will be cleared. Your framing and focus will be kept."*
- **Start over** — full session reset.

### Loading state

Between "Convene the board" click and the response, render a full-width card:

```
    [loading dots]

Four advisors are reading your profile...
```

Long Ollama runs will be slow. The copy sets expectation and prevents students from clicking again.

---

## Chat chain integration

### `ChatComposer.tsx`

Add optional `onBoard?: () => void` and `boardDisabled?: boolean` props alongside existing chain props. When provided, render a chain button *"Try as board review →"* in the same pattern as the Odyssey and career-gen chain buttons. Disabled from the parent when `distilling || userMessageCount < 3`.

### `app/chat/page.tsx` — `handleBoard`

```tsx
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
          'Produce a one-to-two sentence framing summary describing what the student seems to be worried about or wanting feedback on in this conversation. This will be used as the opening question for a Board of Advisors profile review. Write it in first person from the student\'s perspective ("I\'m worried that..."). Put this in the "background" field.',
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
      err instanceof Error ? err.message : 'Could not set up board review from this chat.'
    );
  } finally {
    setDistilling(false);
  }
}
```

**Why reuse `distillProfile`:** same rationale as Odyssey. It already turns a chat transcript into a structured summary, and the `guidance` parameter lets us re-shape the output. One less route to build.

---

## Career card shortcut

`components/CareerNode.tsx` already has a row of shortcut buttons (Chat about this, Analyse gaps, Learning path for this role). Add a fourth button *"Ask the board about this role"* next to the others. Handler:

```tsx
function handleBoardShortcut() {
  useSessionStore.getState().setBoardPrefill({ focusRole: data.jobTitle });
  router.push('/board');
}
```

Same pattern as the other card shortcuts. No pre-flight LLM check here — the board page runs its own pre-flight when the student clicks Convene.

---

## Landing integration

### ActionsZone — Reflect group

The Reflect group added in F11 currently holds one button ("Imagine three lives") in a `grid-cols-2 md:grid-cols-3` layout with room to grow. F12 adds the second slot:

```tsx
<section>
  <div className='editorial-rule justify-center mb-3'>
    <span>Reflect</span>
  </div>
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
</section>
```

Lucide `Users` icon. Handler:

```tsx
async function handleBoard() {
  clearMissingHints();
  if (!(await ensureProvider())) return;
  router.push('/board');
}
```

No pre-flight input validation at the landing — the `/board` page has per-visit validation (disabled convene button when no profile material).

### OutputsBanner

Add one more quick-jump link:

```tsx
const hasBoard = !!boardReview;

{hasBoard && (
  <Link href='/board' className='underline hover:text-accent'>
    board review ready
  </Link>
)}
```

Include `!hasBoard` in the early-return guard.

---

## Markdown export

New function `boardReviewToMarkdown(review: BoardReview): string` in `lib/markdown-export.ts`. Output:

```markdown
# Board of Advisors Review

**Your framing:** <framing or "Open review — no specific focus">
**Focus role:** <focusRole or "None">

## The Recruiter
<response>

## The HR Partner
<response>

## The Hiring Manager
<response>

## The Mentor
<response>

## Where the board landed

### Where they agreed
- point
- point

### Where they pushed back on each other
- point
- point

### What to work on
1. priority
2. priority
3. priority

---

*Four AI-generated perspectives. Disagreement is part of the exercise.*
```

Empty synthesis subsections render their `h3` only if the array is non-empty — skip empty sections in the output.

---

## Error handling

- **No LLM provider configured** → pre-flight on every entry point. Toast + redirect to `/settings`.
- **No profile material** → convene button disabled with inline helper. The API route also 400s as defence-in-depth.
- **Empty framing** → legal. API prompt omits the `<framing>` block entirely.
- **Empty focus role** → legal. API prompt omits the `<focusRole>` block entirely.
- **Token limits** → trim `jobAdvert` (4000 chars), then `resume` (4000 chars), then 500 with *"This profile is too long for the board to review. Try trimming your resume or about you."*
- **Parse failures** → route returns 500 with the parse error message. UI toast: *"The board's response wasn't quite right. Try again — sometimes a second attempt works."* Input fields preserved.
- **Chat chain failure** → toast *"Could not set up board review from this chat. Open the Board of Advisors from the landing manually."* Stay on `/chat`.
- **Navigate away mid-convene** → request drops silently. No abort controller wiring.
- **Reload Electron** → `boardReview` lost (in-memory only).

---

## Testing

### Unit tests (Vitest)

- **`lib/session-store.test.ts`** — extend with: `setBoardReview`, `setBoardPrefill`, `consumeBoardPrefill` reads-and-clears, `reset()` clears both `boardReview` and `boardPrefill`.
- **`lib/prompts/board.test.ts`** — `buildBoardPrompt`:
  - Includes framing when non-empty, omits when empty
  - Includes focus role when non-null, omits when null
  - Includes profile context (resume, aboutYou, distilledProfile, jobAdvert)
  - Asks for all 4 advisor roles
  - Asks for the synthesis shape
  - `parseBoardReview`:
    - Happy path returns four voices + synthesis
    - Markdown code fences stripped
    - Voice order coerced to canonical `[recruiter, hr, manager, mentor]` even if LLM emits them out of order
    - Missing role throws
    - Empty voice response throws
    - Missing synthesis arrays coerce to `[]`
    - All three synthesis arrays empty throws
- **`lib/markdown-export.test.ts`** — extend with `boardReviewToMarkdown` snapshot tests:
  - Full happy path
  - Empty framing → "Open review — no specific focus"
  - Null focus role → "None"
  - Empty disagreements/priorities sections are skipped (only non-empty sections render)
  - AI-generated footer present

### Manual QA checklist

- [ ] Landing Reflect group now shows two buttons (Imagine three lives, Board of advisors) with icons
- [ ] Click "Board of advisors" → navigates to `/board`, input view, both fields empty
- [ ] With no profile material → convene button disabled with helper text
- [ ] With resume uploaded → convene enabled → click → loading state → review view with 4 voices + synthesis
- [ ] Voices render in fixed order (Recruiter, HR, Manager, Mentor) regardless of LLM's order
- [ ] Synthesis shows agreements, disagreements, priorities with matching headings
- [ ] Framing field populated → convene → review echoes framing at the top
- [ ] Focus role field populated → convene → review echoes focus role at the top
- [ ] Copy as Markdown → includes framing, focus, four voices, synthesis, footer
- [ ] Empty framing + empty focus → Markdown shows "Open review — no specific focus" and "None"
- [ ] Run again → confirmation → returns to input view with previous framing + focus pre-filled
- [ ] Start over → confirms → all session cleared including boardReview
- [ ] Career card "Ask the board about this role" → navigates to `/board` with focus pre-filled
- [ ] Visit `/board` a second time (back/nav) → pre-fill does NOT re-apply (read-and-clear worked)
- [ ] Chat, after 3 user messages → "Try as board review →" chain enabled
- [ ] Click chain → distillation → `/board` with framing pre-filled from chat
- [ ] OutputsBanner shows "board review ready" once a review exists
- [ ] Click OutputsBanner link → returns to `/board` in review view
- [ ] Force a parse error (via a toy provider if possible) → toast + input fields preserved
- [ ] Force a token-limit error → trim chain triggers → eventual success or honest 500 message
- [ ] No LLM provider configured → pre-flight redirect to `/settings` from landing button and convene button
- [ ] Reload Electron → state lost (expected)
- [ ] All existing 6 landing buttons still work and are in their correct groups
- [ ] Electron dev build end to end

### Not testing in F12

- Actual persona quality or voice consistency (subjective; manual review)
- Whether the LLM produces real disagreements vs surface disagreements (manual review)
- API route LLM path (thin wrapper; covered by manual QA)

---

## Scope & non-goals

### In scope

- Session store `BoardReview` + `BoardPrefill` types, fields, actions, reset integration
- `lib/prompts/board.ts` with prompt builder + parser + tests
- `lib/markdown-export.ts` extended with `boardReviewToMarkdown` + tests
- `app/api/board/route.ts` with trim-retry chain
- `app/board/page.tsx` orchestrator
- `components/board/BoardInputCard.tsx`
- `components/board/BoardVoices.tsx`
- `components/board/BoardSynthesisPanel.tsx`
- `components/landing/ActionsZone.tsx` — add "Board of advisors" to Reflect group
- `components/landing/OutputsBanner.tsx` — add board review quick-jump link
- `components/chat/ChatComposer.tsx` — optional `onBoard` chain button
- `app/chat/page.tsx` — `handleBoard` handler
- `components/CareerNode.tsx` — "Ask the board about this role" shortcut

### Explicitly out of scope (deferred)

| Deferred | Target |
|---|---|
| F10 Career Path Comparison | Next feature after F12 |
| Historical board runs | Never — session-only; students can copy-as-markdown before re-running |
| Student-picked advisor personas | Never — fixed four is a design decision, not a limitation |
| Student-created custom personas | Never — scope creep |
| Separate API call per advisor | Never — one call keeps it fast on Ollama and lets voices reference each other |
| Board responding to follow-up questions | Never — one-shot review, not a chat. Students use the real chat for follow-up. |
| Grounded board with web search | Never — voiced reflection work, grounding is gap analysis territory |
| PDF export | Later export work |
| Sharing a board review externally | Never — offline-first |
| Dashboard-style ratings on the review | Never — synthesis is the reflection artefact, not a scorecard |

### Carry-forward notes

- **`boardPrefill` read-and-clear transient** is a pattern F10 will want for "Compare these careers" pre-fill. Build it carefully here and F10 can reuse the `consume*Prefill` shape.
- F10 Career Comparison remains undecided between landing entry and `/careers` multi-select. Revisit after F12 ships.

---

## Open questions

None blocking. Resolved during brainstorming:

- Scope of the question → B+focus hybrid (review of whole profile with optional target)
- Who's on the board → Fixed four (Recruiter / HR / Manager / Mentor)
- Response shape → Free-form voices + board synthesis (agreements / disagreements / priorities)
- Number of LLM calls → One call, four personas in the prompt
- Entry points → Landing Reflect + chat chain + career card shortcut
- Input UI → Two separate fields (framing textarea + focus role input)
- Persistence → Session-only + Copy as Markdown
- Grounding → None
