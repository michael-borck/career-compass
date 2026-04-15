# F10 — Career Path Comparison

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Phase reference:** Originally Phase 4 in `docs/phasing-proposal.md`. Shipping F10 last in Phase 4, after F11 (Odyssey) and F12 (Board of Advisors).

---

## Summary

F10 ships side-by-side comparison of 2 or 3 career paths across seven fixed dimensions (typical day, core skills, training needed, salary range, work setting, who it suits, main challenge). Two entry points produce one destination: a **quick mode** from the landing page (student types raw job titles) and a **rich mode** from `/careers` (student picks 2-3 of the six generated spider-graph cards). Both modes call the same LLM endpoint and render the same scannable table.

The pedagogical value is decision support. After a student has explored careers via chat, generation, gap analysis, and reflection features, comparison is the "sit down and actually look at these next to each other" step. It turns a vague sense of multiple options into a concrete, row-by-row read that highlights trade-offs.

---

## Design principles (inherited, unchanged)

- No persistence beyond settings. Comparison state lives in the session store, in-memory only.
- Privacy-first. No new outbound traffic; no grounding — this is structured reflection, not market research.
- Export, don't save. Copy-as-Markdown renders the whole table into a portable document.
- Reuse before rebuild. The existing `finalCareerInfo` shape is the rich-mode data source. Existing `CopyMarkdownButton`, landing gating pattern, `.editorial-rule` CSS, `OutputsBanner` quick-jump all apply.
- Two entry points, one destination. Fighting duplication means one prompt builder, one parser, one result view, one API route.

---

## Architecture

### Routes

- `app/compare/page.tsx` — single page with two internal views:
  1. **Input view** (shown when `comparison` is null and the entry was quick mode) — `CompareInputCard` with three target slots
  2. **Result view** (shown when `comparison` exists) — the comparison table + chain-out row
- Rich-mode entry skips the input view entirely: the page mounts, consumes the prefill, immediately fires the API call with the resolved career data, and transitions straight from loading state to result view.

### Session store additions

New types in `lib/session-store.ts`:

```ts
export type ComparisonDimension =
  | 'typicalDay'
  | 'coreSkills'
  | 'trainingNeeded'
  | 'salaryRange'
  | 'workSetting'
  | 'whoItSuits'
  | 'mainChallenge';

export type ComparisonRole = {
  label: string;
  cells: Record<ComparisonDimension, string>;
};

export type Comparison = {
  mode: 'quick' | 'rich';
  roles: ComparisonRole[];
};

export type ComparePrefill = {
  seedTarget?: string;
  richCareerTitles?: string[];
};
```

New fields on `SessionState`:

```ts
comparison: Comparison | null;
comparePrefill: ComparePrefill | null;
comparing: string[];
```

- `comparison` — the last completed comparison, shown on `/compare` result view and in OutputsBanner.
- `comparePrefill` — read-and-clear transient. Written by landing handler (quick mode seed) or `/careers` banner Compare button (rich mode career IDs). Read and cleared on `/compare` page mount.
- `comparing` — live selection state on `/careers`. Array of career titles the student has toggled "Compare this role" on. Capped at 3. Persists across navigation within a session. Cleared by Cancel button, full reset, or when a comparison is launched.

New actions:

```ts
setComparison: (c: Comparison | null) => void;
setComparePrefill: (p: ComparePrefill | null) => void;
consumeComparePrefill: () => ComparePrefill | null;
toggleComparing: (careerTitle: string) => void;
clearComparing: () => void;
```

`reset()` clears all three automatically via `set({ ...initialState })`.

`toggleComparing` behaviour:
- If the title is already in `comparing`, remove it (no cap check).
- Otherwise, if `comparing.length >= 3`, silently no-op (the UI button should already be disabled).
- Otherwise, add the title to the end of the list.

### New API route

- `app/api/compare/route.ts` — thin wrapper. Accepts `{ mode, targets, resume?, freeText?, distilledProfile?, llmConfig? }`. Calls LLM with the compare prompt. Returns `{ comparison, trimmed }`. Trim-retry chain: advert within targets → resume → 500.

### New pure modules

| Path | Responsibility |
|---|---|
| `lib/prompts/compare.ts` | `buildComparePrompt(input)` + `parseComparison(raw, input)` |
| `lib/prompts/compare.test.ts` | Unit tests |

### Modified modules

- `lib/session-store.ts` — new types, fields, actions
- `lib/session-store.test.ts` — extended tests
- `lib/markdown-export.ts` — add `comparisonToMarkdown`
- `lib/markdown-export.test.ts` — extended tests
- `components/landing/ActionsZone.tsx` — add "Compare careers" button to Discover group (grid becomes `grid-cols-2 md:grid-cols-3`); wire `handleCompare` with target gating
- `components/landing/ActionWillUse.tsx` — add `'compare'` case to the switch
- `components/landing/OutputsBanner.tsx` — add "comparison ready" quick-jump link
- `components/CareerNode.tsx` — add "Compare this role" / "Remove from comparison" toggle button in the shortcut row; add `ring-2 ring-accent` selection state
- `app/careers/page.tsx` — render a top banner above the ReactFlow container when `comparing.length > 0`

### New components

- `app/compare/page.tsx` — orchestrator. Reads prefill on mount, branches to rich-mode direct-fire or quick-mode input view.
- `components/compare/CompareInputCard.tsx` — three fixed target slots (Target 1 pre-fillable, Target 2 required, Target 3 optional) + helper note + Run button.
- `components/compare/CompareTable.tsx` — scannable rows-as-dimensions table. 2 or 3 columns. Mobile fallback stacks as per-role cards.

---

## Entry points

### Entry 1 — Landing "Compare careers" button (quick mode)

**Placement:** Discover group, alongside "Find my careers" and "Start chatting". The Discover grid becomes `grid-cols-2 md:grid-cols-3` to fit three buttons.

**Gate:** Requires at least one of `jobTitle | jobAdvert`. Profile is NOT required — quick comparison works without one. Gate implementation mirrors existing `handleGapAnalysis` structure:

```tsx
async function handleCompare() {
  clearMissingHints();
  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  if (!hasTarget) {
    setMissingHints({
      resume: false,
      jobTitle: true,
      aboutYou: false,
      jobAdvert: true,
      message: 'Compare needs at least one job title or job advert to start. You can add more targets on the next page.',
    });
    focusFirstHint();
    return;
  }
  if (!(await ensureProvider())) return;
  store.setComparePrefill({
    seedTarget: store.jobAdvert.trim() || store.jobTitle.trim(),
  });
  router.push('/compare');
}
```

**Button:** Lucide `Columns3` icon.

```tsx
<Button onClick={handleCompare} disabled={anyRunning} variant='outline' className='py-6'>
  <Columns3 className='w-4 h-4 mr-2' />
  Compare careers
</Button>
```

**Transparency caption (`ActionWillUse.tsx`):**

```ts
case 'compare': {
  if (!hasTarget) return 'Needs a target (job title or job advert).';
  return `Will use: ${filled.join(', ')}. Add more targets on the next page.`;
}
```

### Entry 2 — `/careers` spider graph multi-select (rich mode)

**Card-level toggle button.** Added as a fifth sibling in each `CareerNode`'s shortcut row, alongside Chat about this / Analyse gaps / Learning path / Ask the board.

```tsx
const inComparison = comparing.includes(data.jobTitle);
const atMax = comparing.length >= 3 && !inComparison;

<Button
  variant='outline'
  size='sm'
  onClick={() => useSessionStore.getState().toggleComparing(data.jobTitle)}
  disabled={atMax}
  title={atMax ? 'Maximum 3 roles. Remove one to add another.' : undefined}
>
  {inComparison ? (
    <><X className='w-3 h-3 mr-1' /> Remove from comparison</>
  ) : (
    <><Columns3 className='w-3 h-3 mr-1' /> Compare this role</>
  )}
</Button>
```

Card visual selection state — conditional ring on the card body:

```tsx
<div className={`... ${inComparison ? 'ring-2 ring-accent' : ''}`}>
```

Two redundant cues: the ring is the at-a-glance visual, the button label is the next-action confirmation.

**Banner (appears when `comparing.length > 0`).** Rendered at the top of `/careers` above the ReactFlow graph. Styled like `OutputsBanner`:

```
● Comparing: Data analyst, UX researcher    click one more (optional)    [Compare 2] [Cancel]
```

- Dot indicator matches OutputsBanner's `bg-accent` dot
- Comma-joined list of selected titles
- Helper text varies by count: `length < 3` → *"click one more (optional)"*; `length === 3` → *"maximum reached"*
- **Compare button** label reads *"Compare 2"* or *"Compare 3"*. Disabled when `length < 2`. On click: writes `{ richCareerTitles: [...comparing] }` to `comparePrefill`, calls `clearComparing()`, and navigates to `/compare`.
- **Cancel button** calls `clearComparing()`, banner disappears.

**Rich-mode entry to `/compare`.** When the page mounts and `consumeComparePrefill()` returns `{ richCareerTitles: [...] }`:
1. Look up each title in `store.careers` (match on `jobTitle`) to get the full `finalCareerInfo` for each role.
2. If any title fails to resolve (edge case: careers array cleared between selection and navigation), toast *"The selected careers are no longer available. Generate careers again and retry."* and drop into the empty input card view.
3. Otherwise, skip the input card entirely. Show a full-width loading state (*"Comparing three careers…"*). Fire `/api/compare` immediately with `mode: 'rich'` and the resolved targets.
4. On success, transition to the result view.

---

## Quick-mode input view

Shown when the page mounts with `consumeComparePrefill()` returning `{ seedTarget }` or nothing. Layout:

```
[← Back]                                              [Start over]

────── Compare careers ──────
Quick side-by-side across seven dimensions

(helper note, soft)
Quick compare is vague. It makes assumptions about each role.
For a richer comparison, run Find my careers first, pick 2 or 3
from the spider graph, and compare from there.

┌─ Target 1 ─────────────────────────────────────────────┐
│ [Data analyst]                         (from landing)   │
└─────────────────────────────────────────────────────────┘

┌─ Target 2 (required) ──────────────────────────────────┐
│ [job title or paste a short job advert              ]  │
└─────────────────────────────────────────────────────────┘

┌─ Target 3 (optional) ──────────────────────────────────┐
│ [job title or paste a short job advert              ]  │
└─────────────────────────────────────────────────────────┘

Comparison uses your profile (resume / about you) for personalised framing if available.

                [Run comparison]
```

### Slot wiring

- **Target 1** — pre-filled from `comparePrefill.seedTarget` on mount. Editable. Subtitle text *"(from landing)"* when pre-fill was applied; hidden on reload/bookmark.
- **Target 2** — required, empty, focused on mount. Placeholder: *"Job title (e.g. UX researcher) or paste a short job advert."*
- **Target 3** — optional, empty, marked *"(optional)"*. Same placeholder.
- **Run button** — disabled until both Target 1 and Target 2 are non-empty. Pre-flight `isLLMConfigured()` check; toast + `/settings` redirect if not. On click: local `comparing` spinner state, POST `/api/compare`.

### Helper note

The *"Quick compare is vague"* note sits above the slots as a standing, educational helper — not an error. Studio Calm styling:

```tsx
<div className='border-l-2 border-accent p-4 bg-paper-warm mb-6'>
  <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
    Quick compare is vague. It makes assumptions about each role. For a richer
    comparison, run <strong>Find my careers</strong> first, pick 2 or 3 from the
    spider graph, and compare from there.
  </p>
</div>
```

### Profile hint

Single subtle line above the Run button: *"Comparison uses your profile (resume / about you) for personalised framing if available."* No gate on profile — the LLM gets generic framing if no profile is present.

---

## The prompt

### `lib/prompts/compare.ts`

```ts
import type { StudentProfile, finalCareerInfo } from '@/lib/types';
import type { Comparison, ComparisonRole, ComparisonDimension } from '@/lib/session-store';

export type CompareMode = 'quick' | 'rich';

export type CompareTarget = {
  label: string;
  context?: finalCareerInfo;
};

export type CompareInput = {
  mode: CompareMode;
  targets: CompareTarget[];
  resume?: string;
  freeText?: string;
  distilledProfile?: StudentProfile;
};

export function buildComparePrompt(input: CompareInput): string;
export function parseComparison(raw: string, input: CompareInput): Comparison;
```

### Prompt body

> You are helping a student compare {N} possible career paths side-by-side. Produce a structured comparison across seven fixed dimensions so the student can scan and decide.
>
> Be specific and honest. Don't hedge. If one role pays more than another, say so. If one has a harder entry path, say so. Keep each cell short and scannable — 1-2 sentences, no more.
>
> Respond with JSON in EXACTLY this shape (no prose, no code fences):
>
> ```
> {
>   "roles": [
>     {
>       "label": string (the role title),
>       "cells": {
>         "typicalDay": string (1-2 sentences on what a typical day looks like),
>         "coreSkills": string (1-2 sentences on the most important skills),
>         "trainingNeeded": string (1-2 sentences on how someone gets into this),
>         "salaryRange": string (1-2 sentences with a rough range and range-dependent caveats),
>         "workSetting": string (1-2 sentences on team size, environment, autonomy),
>         "whoItSuits": string (1-2 sentences on the kind of person who thrives),
>         "mainChallenge": string (1-2 sentences on the honest downside)
>       }
>     },
>     ...
>   ]
> }
> ```
>
> `<targets>...</targets>` — one block per target with label and, in rich mode, the existing career data (skills, salary, description) as context for the LLM to use as the source of truth
> `<profile>...</profile>` — student profile if provided (resume / about me / distilled profile)
>
> In rich mode, the comparison cells should be consistent with what the student has already seen on the spider graph — don't contradict the existing career data.
>
> ONLY respond with JSON. No prose, no code fences.

Temperature ~0.4 — structured output, not creative voice. Mirrors gap analysis and odyssey.

### Parser

`parseComparison(raw, input)` validates:

- Strips markdown code fences via `cleanJSON` helper.
- `roles` is an array of length equal to `input.targets.length` (2 or 3). Throws if not.
- Each role has a non-empty `label`. Throws if not.
- Each role's `cells` object has all seven dimensions. Missing dimensions coerce to `"—"` rather than throw — a missing cell is better than a hard fail, and "—" renders as a neutral placeholder.
- Returns a `Comparison` object with `mode: input.mode` attached.

### API route — trim-retry

`app/api/compare/route.ts`:

1. Validates `targets.length` is 2 or 3. 400 otherwise.
2. Validates each target has a non-empty `label`. 400 otherwise.
3. Builds prompt with full context.
4. On token limit: trim each target's `label` if it's longer than 4000 chars (job adverts pasted into slots can be long). Retry.
5. On token limit: trim `resume` to 4000 chars. Retry.
6. On token limit after both trims: 500 with *"These comparisons are too long to run together. Try shorter descriptions or remove a target."*
7. Parses response. On parse throw: 500 with the parse error message.

Returns `{ comparison: { mode, roles }, trimmed }` on success.

---

## Result view

After the comparison runs, `/compare` renders:

```
[← Back]   Career comparison               [Copy as Markdown] [Run another] [Start over]

────── Career comparison ──────
(helper note reminder visible only in quick mode)

                    │  Data analyst     │  UX researcher    │  Product manager
────────────────────┼───────────────────┼───────────────────┼───────────────────
Typical day         │  <cell>           │  <cell>           │  <cell>
Core skills         │  <cell>           │  <cell>           │  <cell>
Training needed     │  <cell>           │  <cell>           │  <cell>
Salary range        │  <cell>           │  <cell>           │  <cell>
Work setting        │  <cell>           │  <cell>           │  <cell>
Who it suits        │  <cell>           │  <cell>           │  <cell>
Main challenge      │  <cell>           │  <cell>           │  <cell>

Next steps:
  [Analyse gaps for ▾]   (dropdown of the 2 or 3 roles)
```

### `CompareTable` component

- Receives `comparison: Comparison`.
- Desktop: CSS grid — `grid-cols-[auto_1fr_1fr]` for 2 roles or `grid-cols-[auto_1fr_1fr_1fr]` for 3. First column is dimension labels (`text-ink-muted font-medium`), subsequent columns are roles (header row `text-ink font-semibold`). Cells `p-4`, `text-ink-muted`, top-aligned.
- Mobile (`md:` breakpoint): falls back to stacked cards — one card per role, each card is a labelled key-value list of the seven dimensions.
- Dimension row order is fixed: `['typicalDay', 'coreSkills', 'trainingNeeded', 'salaryRange', 'workSetting', 'whoItSuits', 'mainChallenge']`.
- Dimension display labels come from a local constant map.

### Helper note in quick mode

When `comparison.mode === 'quick'`, the result view shows a compact reminder above the table: *"This is a quick compare — the LLM inferred each role's details. For a richer comparison based on your generated careers, run Find my careers from the landing page."* Subtle, not alarming.

### Chain-out row

Below the table:

- **Analyse gaps for [role] ▾** — dropdown menu listing the 2 or 3 compared roles. Selecting one writes that role's label to `store.jobTitle`, triggers the existing gap-analysis flow (same path as the career-card gap shortcut from F7), and navigates to `/gap-analysis`.
- **Copy as Markdown** — standard `CopyMarkdownButton` using `comparisonToMarkdown(comparison)`.
- **Run another** — clears `comparison`, returns to the input view. In quick mode, pre-fills the input card via `comparePrefill` with the previous Target 1 as seed so the student can tweak and re-run. In rich mode, confirmation dialog asks whether to return to `/careers` (to pick different cards) or to stay on `/compare` and enter a quick-mode comparison.

### Loading state

Shared for both modes: a full-width card with `LoadingDots` and the text *"Comparing {N} careers..."*. Sets expectation for long Ollama runs.

---

## Markdown export

New function `comparisonToMarkdown(comparison: Comparison): string`. Output:

```markdown
# Career Comparison

**Mode:** Quick compare *(LLM-generated from job titles — vague, makes assumptions)*

## Roles compared
1. Data analyst
2. UX researcher
3. Product manager

## Comparison

### Typical day
- **Data analyst:** <cell>
- **UX researcher:** <cell>
- **Product manager:** <cell>

### Core skills
- **Data analyst:** <cell>
- **UX researcher:** <cell>
- **Product manager:** <cell>

### Training needed
...

### Salary range
...

### Work setting
...

### Who it suits
...

### Main challenge
...

---

*AI-generated comparison. Treat specific salary figures and training timelines as starting points, not guarantees.*
```

**Mode line:**
- Quick → `**Mode:** Quick compare *(LLM-generated from job titles — vague, makes assumptions)*`
- Rich → `**Mode:** Rich compare *(based on careers from your spider graph)*`

Dimension-rows-as-markdown-sections reads better than pipe tables (which get ugly with 2-3 sentence cells). Each dimension is an `h3` with one bullet per role.

---

## Landing integration

### ActionsZone — Discover group now holds three

```tsx
<section>
  <div className='editorial-rule justify-center mb-3'>
    <span>Discover</span>
  </div>
  <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
    <div className='flex flex-col'>
      <Button onClick={handleFindCareers} disabled={anyRunning} className='py-6'>
        <Compass className='w-4 h-4 mr-2' />
        Find my careers
      </Button>
      <ActionWillUse actionId='careers' />
    </div>
    <div className='flex flex-col'>
      <Button onClick={handleStartChatting} disabled={anyRunning} variant='outline' className='py-6'>
        <MessageCircle className='w-4 h-4 mr-2' />
        Start chatting
      </Button>
      <ActionWillUse actionId='chat' />
    </div>
    <div className='flex flex-col'>
      <Button onClick={handleCompare} disabled={anyRunning} variant='outline' className='py-6'>
        <Columns3 className='w-4 h-4 mr-2' />
        Compare careers
      </Button>
      <ActionWillUse actionId='compare' />
    </div>
  </div>
</section>
```

### OutputsBanner

Add one more quick-jump link:

```tsx
const hasComparison = !!comparison;

{hasComparison && (
  <Link href='/compare' className='underline hover:text-accent'>
    comparison ready
  </Link>
)}
```

Include `!hasComparison` in the early-return guard.

---

## Error handling

- **LLM provider not configured** → pre-flight on landing button, quick-mode Run button, and rich-mode mount. Toast + `/settings` redirect.
- **No target on landing** → red-highlight gate, same pattern as gap analysis.
- **Rich-mode prefill fails to resolve** (career IDs no longer in `store.careers`) → toast *"The selected careers are no longer available. Generate careers again and retry."* Drop into empty quick-mode input view.
- **Target 2 empty on quick-mode Run click** → button is disabled, so this shouldn't happen. Defence-in-depth: API 400 on `targets.length < 2`.
- **Token limits** → trim chain (target labels first, then resume). Honest 500 on exhaustion.
- **Parse failure** → route returns 500 with message. UI toast *"The comparison came back garbled. Try again — a second attempt often works."* Input preserved in quick mode.
- **Navigate away mid-call** → request drops silently. No abort controller.
- **Reload Electron** → all comparison state lost (in-memory only).

---

## Testing

### Unit tests (Vitest)

- **`lib/session-store.test.ts`** — extend with: `setComparison`, `setComparePrefill`, `consumeComparePrefill` reads-and-clears, `toggleComparing` adds/removes/caps at 3 silently, `clearComparing`, `reset()` clears all three.
- **`lib/prompts/compare.test.ts`** — `buildComparePrompt`:
  - Includes all target labels
  - Rich mode embeds `finalCareerInfo` context for each target
  - Quick mode does not embed context
  - Includes profile when provided (resume / freeText / distilledProfile)
  - Omits profile section when all profile fields are absent
  - Asks for the seven-dimension JSON shape
  - `parseComparison`:
    - Happy path returns 2 or 3 roles with all seven cells
    - Strips markdown code fences
    - Throws when role count doesn't match `input.targets.length`
    - Throws when a role has an empty label
    - Coerces missing cells to `"—"` (no throw)
    - Attaches `mode` from input to the returned Comparison
- **`lib/markdown-export.test.ts`** — extend with `comparisonToMarkdown` snapshot tests:
  - Quick mode shows the vague-compare mode header
  - Rich mode shows the spider-graph mode header
  - 2-role comparison renders correctly
  - 3-role comparison renders correctly
  - All seven dimensions appear as `h3` sections
  - Each section has the correct number of role bullets
  - Footer present at the end

### Manual QA checklist

- [ ] Landing Discover group now shows three buttons (Find my careers, Start chatting, Compare careers) with icons
- [ ] Transparency captions under each Discover button reflect live state
- [ ] Click Compare careers with no target → red highlight on Job title + Job advert rows with helper message
- [ ] Type a job title → caption updates → click Compare careers → navigates to `/compare` with Target 1 pre-filled
- [ ] Paste a short advert instead of typing a title → caption updates → Compare navigates with Target 1 pre-filled from advert (first line truncated if long)
- [ ] Helper note visible above the slots on quick-mode input view
- [ ] Run button disabled until Target 1 and Target 2 are both filled
- [ ] Fill both targets → Run → loading state → result view renders table with two columns
- [ ] Fill all three → Run → result view renders table with three columns
- [ ] All seven dimension rows present and non-empty (or showing "—" for missing cells)
- [ ] Mobile viewport: table falls back to stacked cards (one per role)
- [ ] Copy as Markdown → includes quick-mode header, all seven dimension sections, role bullets, footer
- [ ] Run another from quick-mode result → returns to input view with previous Target 1 pre-filled
- [ ] Quick-mode reminder note visible above the table on the result view
- [ ] Start over from `/compare` → confirms → clears comparison, comparing, prefill, full session
- [ ] OutputsBanner shows "comparison ready" after a run
- [ ] Click OutputsBanner link → returns to `/compare` result view
- [ ] Run Find my careers → `/careers` → each card shortcut row now shows "Compare this role" button alongside existing shortcuts
- [ ] Click "Compare this role" on one card → button label flips to "Remove from comparison", card gets ring-2 ring-accent, top banner appears with the title and "click one more (optional)"
- [ ] Click "Compare this role" on a second card → banner updates with both titles, Compare button activates
- [ ] Click "Compare this role" on a third card → banner says "maximum reached"
- [ ] Click "Compare this role" on a fourth card → button is disabled with tooltip "Maximum 3 roles. Remove one to add another."
- [ ] Click "Remove from comparison" on one of the three → banner updates, that card loses its ring, fourth card's button re-enables
- [ ] Navigate away from `/careers` and back → banner and selection persist
- [ ] Click Cancel on banner → selection cleared, all rings removed, banner disappears
- [ ] Click Compare (2 or 3) on banner → navigates to `/compare` in rich mode, skips input view, shows loading state, renders table
- [ ] Rich mode result view: Copy as Markdown header shows "Rich compare" mode line
- [ ] Rich mode Run another → confirmation asking whether to return to `/careers` or stay with quick mode
- [ ] Analyse gaps for dropdown → select a role → navigates to `/gap-analysis` with that role pre-filled as target
- [ ] Force a parse error → toast + input preserved
- [ ] Force a token-limit error → trim chain triggers → eventual success or honest 500 message
- [ ] No LLM provider configured → pre-flight redirect from landing button, quick-mode Run, and rich-mode auto-fire
- [ ] Reload Electron → all state lost (expected)
- [ ] All existing 7 action buttons (6 before F10 + Compare) still work and are in their correct groups
- [ ] Electron dev build end to end

### Not testing in F10

- Actual comparison quality (subjective; manual review)
- Whether rich-mode cells are genuinely consistent with existing spider-graph data (manual review)
- Pedagogical effectiveness of the seven dimensions (that's what shipping is for)

---

## Scope & non-goals

### In scope

- Session store `Comparison`, `ComparePrefill`, `comparing` types, fields, actions, reset integration
- `lib/prompts/compare.ts` with prompt builder + parser + tests
- `lib/markdown-export.ts` extended with `comparisonToMarkdown` + tests
- `app/api/compare/route.ts` with trim-retry
- `app/compare/page.tsx` orchestrator (input view + result view + rich-mode direct-fire)
- `components/compare/CompareInputCard.tsx`
- `components/compare/CompareTable.tsx`
- `components/landing/ActionsZone.tsx` — add Compare careers button to Discover group with gate
- `components/landing/ActionWillUse.tsx` — add `'compare'` case
- `components/landing/OutputsBanner.tsx` — add comparison quick-jump
- `components/CareerNode.tsx` — add "Compare this role" / "Remove from comparison" toggle + ring selection state
- `app/careers/page.tsx` — add top banner for building the comparison list

### Explicitly out of scope (deferred / never)

| Deferred | Target |
|---|---|
| Chat-about-this-comparison chain | Never — YAGNI, student can copy-paste into chat |
| Shareable comparison link | Never — offline-first |
| More than 3 roles at once | Never — comparison fatigue, mobile layout pain |
| Radar/spider visual comparison (not table) | Could revisit later; the table is the MVP |
| Weighted comparison (student ranks dimensions) | YAGNI — students read the rows they care about |
| Rich mode without an LLM call (pure field mapping) | Rejected during brainstorming — one code path is better |
| Per-role "learn more" expansion | Redundant with "Analyse gaps for X" chain-out |
| PDF export | Later export work, not comparison-specific |
| Saving multiple comparisons as history | Session-only; copy-as-markdown is the workaround |

### Carry-forward notes

- The `comparePrefill` read-and-clear pattern extends the transient-prefill idiom F12 introduced. Three features now use it (Odyssey, Board, Compare). If a fourth feature needs it, document the pattern in a short codebase convention note.
- The `comparing` live-selection state is the first example of UI state that persists across navigation but isn't an output. If future features need similar live-selection patterns, `comparing` is the reference implementation.
- Phase 4 closes with F10. The next phase is Phase 5 (materials + export — F8, F15, F16).

---

## Open questions

None blocking. Resolved during brainstorming:

- Location → two entry points, one `/compare` destination
- Quick-mode vs rich-mode → both modes call same LLM endpoint, one code path
- Selection mechanic on `/careers` → per-card toggle button that flips label, live banner shows growing list
- Max roles → 3, disabled state prevents a 4th click
- Comparison shape → fixed seven dimensions as table rows
- Chain-outs → gap analysis per-role yes, chat no
- Quick-mode helper note → standing educational helper above input slots
- Persistence → session store, cleared on reset, survives navigation
- Landing placement → Discover group (not Reflect — comparison is decision-support, not reflection)
