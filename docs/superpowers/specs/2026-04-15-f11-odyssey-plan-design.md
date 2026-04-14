# F11 — Odyssey Plan Simulator

**Date:** 2026-04-15
**Status:** Design approved — ready for implementation plan
**Phase reference:** Originally Phase 4 in `docs/phasing-proposal.md`. Shipping F11 alone rather than bundling F11 + F12 + F10 into a single phase, because the three features share no infrastructure and bundling creates a long feedback loop.

---

## Summary

F11 ships the Odyssey Plan Simulator from the Designing Your Life framework. Students imagine three alternative five-year lives — their Current Path, a Pivot, and a Wildcard — and the LLM elaborates each one into a concrete, visceral picture: day in the life, typical week, tools and skills, people they'd work with, honest challenges, and open questions. The student then rates each life across four dimensions (Resources, Likability, Confidence, Coherence) — the reflection work that closes the exercise.

The feature lives at a new `/odyssey` route and introduces no new architectural concepts beyond what's already in the codebase. The biggest structural change is a refactor of the landing page's `ActionsZone` from a flat five-button row into three labelled groups (Discover / Assess / Reflect) so that F11's "Imagine three lives" button has a conceptually coherent home and future features (F12, F10) have room to land.

---

## Design principles (inherited, unchanged)

- No persistence beyond settings. Odyssey state lives in the session store, in-memory only.
- Privacy-first. No new outbound traffic; no grounding — Odyssey is imagination work.
- Export, don't save. Copy-as-Markdown renders all three lives plus dashboards into a portable document.
- Reuse before rebuild. The existing `distillProfile` route handles the chat chain seed. The existing `CopyMarkdownButton`, `editorial-rule` CSS, Studio Calm tokens all apply.
- Pedagogy comes first. The student brainstorms the three lives; the LLM elaborates them. Suggestions are optional scaffolding, never a replacement for the student's own thinking.

---

## Architecture

### Routes

- `app/odyssey/page.tsx` — single page with two internal views:
  1. **Card view** (default) — three stacked life cards with seed inputs and elaborate/suggest/regenerate/reset actions
  2. **Compare view** — three-column side-by-side with read-only dashboards

The page toggles between the two views via a "Compare all three" button in the top bar. Compare mode is disabled until at least 2 lives are elaborated.

### Session store additions

New types in `lib/session-store.ts`:

```ts
export type OdysseyLifeType = 'current' | 'pivot' | 'wildcard';

export type OdysseyDashboard = {
  resources: number | null;    // 1-5, student-rated
  likability: number | null;
  confidence: number | null;
  coherence: number | null;
};

export type OdysseyLife = {
  type: OdysseyLifeType;
  // Student input
  label: string;
  seed: string;
  // LLM elaboration (null until elaborated)
  headline: string | null;
  dayInTheLife: string | null;
  typicalWeek: string[];
  toolsAndSkills: string[];
  whoYouWorkWith: string | null;
  challenges: string[];
  questionsToExplore: string[];
  // Student reflection (null until rated)
  dashboard: OdysseyDashboard;
};
```

New field on `SessionState`:

```ts
odysseyLives: Record<OdysseyLifeType, OdysseyLife>;
```

Keyed by type rather than an array so slots are named and the student can never accidentally create a fourth. Initial state has all three slots with empty strings and null elaboration fields.

New actions:

```ts
setOdysseySeed: (type: OdysseyLifeType, label: string, seed: string) => void;
setOdysseyElaboration: (type: OdysseyLifeType, elaboration: Partial<OdysseyLife>) => void;
setOdysseyDashboard: (type: OdysseyLifeType, field: keyof OdysseyDashboard, value: number | null) => void;
resetOdysseyLife: (type: OdysseyLifeType) => void;
```

`reset()` clears all three slots automatically via `set({ ...initialState })`.

### Types

The elaboration data is a subset of `OdysseyLife` — the LLM produces `headline`, `dayInTheLife`, `typicalWeek`, `toolsAndSkills`, `whoYouWorkWith`, `challenges`, `questionsToExplore`. The student supplies `label`, `seed`, and fills `dashboard` themselves.

### New API routes

- `app/api/odysseyElaborate/route.ts` — per-life elaborator. Takes `{ type, label, seed, resumeText?, freeText?, jobTitle?, jobAdvert?, distilledProfile?, llmConfig? }`. Calls LLM with the elaborate prompt. Returns `{ elaboration, trimmed }`. Trim-retry on token limits.
- `app/api/odysseySuggest/route.ts` — per-life seed suggester. Takes `{ type, resumeText?, freeText?, jobTitle?, jobAdvert?, distilledProfile?, llmConfig? }`. Returns `{ label, description }`. No trim-retry (prompt is small).

### New pure modules

| Path | Responsibility |
|---|---|
| `lib/prompts/odyssey.ts` | `buildOdysseyElaboratePrompt(input)` + `parseOdysseyElaboration(raw)` — elaborate a single life from its seed |
| `lib/prompts/odyssey.test.ts` | Unit tests |
| `lib/prompts/odyssey-suggest.ts` | `buildSeedSuggestionPrompt(lifeType, profile)` + `parseSeedSuggestion(raw)` — propose a seed for a specific life type |
| `lib/prompts/odyssey-suggest.test.ts` | Unit tests |

### Modified modules

- `lib/session-store.ts` — new types, fields, actions
- `lib/session-store.test.ts` — extended tests
- `lib/markdown-export.ts` — add `odysseyPlanToMarkdown(lives)`
- `lib/markdown-export.test.ts` — extended tests
- `app/globals.css` — add `.editorial-rule.justify-center` modifier with mirrored right hairline
- `components/landing/ActionsZone.tsx` — refactor into three labelled groups (Discover / Assess / Reflect); add "Imagine three lives" button to Reflect
- `components/landing/OutputsBanner.tsx` — add "odyssey plan in progress" quick-jump link
- `components/chat/ChatComposer.tsx` — optional `onOdyssey?: () => void` prop; when provided, render an extra chain button
- `app/chat/page.tsx` — wire `handleOdyssey` handler that reuses `/api/distillProfile` with custom guidance

### New components

- `app/odyssey/page.tsx` — orchestrator. Reads store, renders card view or compare view based on local state, owns the top-bar toggle.
- `components/odyssey/OdysseyLifeCard.tsx` — per-life card. Seed label/description inputs, elaborate/suggest/regenerate/reset buttons, inline expansion to the elaboration once it exists.
- `components/odyssey/OdysseyElaboration.tsx` — read-only render of an elaborated life (headline, day, week, tools, who, challenges, questions). Reused in card view and compare view.
- `components/odyssey/OdysseyDashboard.tsx` — 4-dimension slider row. Takes props `{ dashboard: OdysseyDashboard; onChange: (field, value) => void; readOnly?: boolean }`. When `readOnly` is true, dots render as static indicators and clicks do nothing. The card view uses the editable form; the compare view passes `readOnly`.
- `components/odyssey/OdysseyCompareView.tsx` — three-column side-by-side with read-only dashboards.

---

## Input + Generation UI

### Orchestrator layout

```
[← Back to landing]    Imagine three lives           [Compare all three]    [Start over]
                                                     (disabled if < 2 elaborated)

  ┌─ Life 1 — Current Path ─────────────────────────────┐
  │ Label / Seed / Actions                               │
  │ (inline elaboration once elaborated)                 │
  └──────────────────────────────────────────────────────┘

  ┌─ Life 2 — The Pivot ────────────────────────────────┐
  │ ...                                                   │
  └──────────────────────────────────────────────────────┘

  ┌─ Life 3 — The Wildcard ─────────────────────────────┐
  │ ...                                                   │
  └──────────────────────────────────────────────────────┘

[Copy as Markdown]
```

Cards stack vertically. On wider screens they stay stacked rather than going three-column — the elaborated output is tall and a 3-column layout shrinks text uncomfortably. Students work on one life at a time anyway.

### `OdysseyLifeCard` — unelaborated state

```
LIFE 1 — CURRENT PATH
─────────────────────
Label
[Data analyst in a health nonprofit          ]

Seed
[I'd finish my degree and join a small health    ]
[research org in Melbourne, working with clinical ]
[data to inform public health decisions.          ]

[Elaborate this life]   [Suggest from profile]
```

- **Label** binds to `store.odysseyLives[type].label` via `setOdysseySeed`. Writes on every keystroke.
- **Seed** binds to `store.odysseyLives[type].seed` via `setOdysseySeed`. Writes on every keystroke. 3-row textarea.
- **Elaborate this life** — primary button. Disabled when seed is empty/whitespace. Local `elaborating` spinner state. Calls `/api/odysseyElaborate` with the life's type, label, seed, and full profile context from the store. On success: writes to the store via `setOdysseyElaboration`, the card expands inline. On failure: toast, card stays unchanged.
- **Suggest from profile** — secondary button. Calls `/api/odysseySuggest` with the life type and profile context. On success: writes the returned `{ label, description }` to the card's seed fields. If the card already has non-empty label or seed content, shows a browser `confirm()` first: *"Replace your current seed with a suggestion?"*. On failure: toast, card unchanged.
- **Pre-flight: no LLM provider configured** — both buttons check `isLLMConfigured()` first and redirect to `/settings` with a toast if not. Same pattern as every existing feature.

### `OdysseyLifeCard` — elaborated state

After a successful elaborate call:

```
LIFE 1 — CURRENT PATH                                  [Regenerate]  [Reset]
─────────────────────────────────────────────────
Label
[Data analyst in a health nonprofit          ]    (editable)

Seed
[I'd finish my degree and join a small health    ]
[research org in Melbourne...                     ]    (editable)

▼ Elaboration

Turning research data into decisions that shape patient care.

A day in 2030
<paragraph>

Typical week
  · 2 days deep in data cleaning and analysis
  · 1 day embedded with program teams translating findings
  · ...

Tools & skills
  · Python + pandas for cleaning and analysis
  · ...

Who you work with
<1-2 sentences>

Challenges
  · Salary ceiling lower than private sector analyst roles
  · ...

Questions to explore
  · Does Australia have enough of these roles?
  · ...

──── How does this feel? ────
Resources   ○ ○ ● ○ ○    "Do I have what I'd need to make this happen?"
Likability  ○ ○ ○ ● ○    "Do I actually like the sound of this?"
Confidence  ○ ● ○ ○ ○    "Am I confident I could make it work?"
Coherence   ○ ○ ○ ● ○    "Does it fit who I'm becoming?"
```

- **Elaboration** rendered by `<OdysseyElaboration />` (shared between card view and compare view).
- **Regenerate** — re-runs `/api/odysseyElaborate` with the current seed. Confirmation dialog: *"Regenerate this life? The current elaboration will be replaced. Your dashboard ratings will be kept."* Preserves the dashboard ratings, overwrites the LLM-generated fields.
- **Reset** — clears the life back to empty (seed, elaboration, dashboard all cleared). Confirmation: *"Reset this life? This clears the seed, elaboration, and ratings."*

### `OdysseyDashboard` — 4-dimension rating row

Student-filled after reading the elaboration. Each dimension is a row of five clickable dots (○/●) with a tooltip on hover explaining what the dimension measures. Click a dot to set the rating. Clicking the same dot again clears it back to null.

Writes to `store.setOdysseyDashboard(type, field, value)` on click. No explicit save — every click persists.

All four dimensions start `null`. If the student skips them (just reads the elaboration and moves on), that's fine — ratings are optional but encouraged.

The compare view renders the dashboard in read-only mode: dots show the values but click-to-edit is disabled. Ratings happen on the card view, not the compare view — this prevents accidental re-rating while scanning the three lives side-by-side.

### Dashboard dimension labels and tooltips

| Dimension | Tooltip question |
|---|---|
| Resources | Do I have what I'd need to make this happen? |
| Likability | Do I actually like the sound of this? |
| Confidence | Am I confident I could make it work? |
| Coherence | Does it fit who I'm becoming? |

These map to the Designing Your Life dashboard framework directly. Resources covers time/money/connections/skills. Likability is gut appeal. Confidence is agency belief. Coherence is identity fit.

---

## Suggestion and elaboration mechanics

### `lib/prompts/odyssey-suggest.ts`

```ts
import type { StudentProfile } from '@/lib/session-store';
import type { OdysseyLifeType } from '@/lib/session-store';

export type SeedSuggestionInput = {
  type: OdysseyLifeType;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type SeedSuggestion = {
  label: string;
  description: string;
};

export function buildSeedSuggestionPrompt(input: SeedSuggestionInput): string;
export function parseSeedSuggestion(raw: string): SeedSuggestion;
```

**Prompt framing per life type:**

- **Current** — *"Based on the student's profile below, what's the most likely natural progression of their current trajectory over the next five years? Propose a one-to-two sentence seed for their Odyssey Plan Life 1 (Current Path)."*
- **Pivot** — *"If the student's current path disappeared tomorrow, what's an alternative career that would use their existing skills in a meaningfully different way? Propose a seed for Life 2 (The Pivot) — same student, different trajectory."*
- **Wildcard** — *"If money, image, and reputation didn't matter, what's a wildly different life this student might find meaningful based on their interests and values? Propose a seed for Life 3 (The Wildcard) — be bold, this is the fantasy slot."*

Plus the shared shape instruction:

> *Respond with JSON in this shape (no prose, no code fences):*
> ```
> { "label": string (3-8 words), "description": string (1-2 sentences, first person) }
> ```
> *If the profile is thin, acknowledge that in the description ("Based on your limited profile, one possibility is...") rather than inventing details.*

**Parser:** throws if `label` or `description` is missing or empty. Strips markdown code fences. No other coercion.

### `lib/prompts/odyssey.ts`

```ts
export type OdysseyElaborateInput = {
  type: OdysseyLifeType;
  label: string;
  seed: string;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type OdysseyElaboration = {
  headline: string;
  dayInTheLife: string;
  typicalWeek: string[];
  toolsAndSkills: string[];
  whoYouWorkWith: string;
  challenges: string[];
  questionsToExplore: string[];
};

export function buildOdysseyElaboratePrompt(input: OdysseyElaborateInput): string;
export function parseOdysseyElaboration(raw: string): OdysseyElaboration;
```

**Prompt body:**

> *You are helping a student imagine a possible future life for their Odyssey Plan. This is life type **{type}** — {brief framing for the type}. The student's seed is below. Elaborate it into a concrete, vivid 5-year-future vision.*
>
> *Make the elaboration tangible and honest. Use specific details (not "works with computers" — "uses Python and Tableau to clean data from regional clinics"). Be honest about challenges — every life has downsides. The student needs to feel what this life would actually be like.*
>
> *Respond with JSON in exactly this shape:*
>
> ```
> {
>   "headline": string — 5-8 word pithy summary of the fleshed-out life,
>   "dayInTheLife": string — vivid paragraph describing a typical day in 2030,
>   "typicalWeek": string[] — 4-6 bullet points on the rhythm of the week,
>   "toolsAndSkills": string[] — concrete tools, tech, skills used,
>   "whoYouWorkWith": string — 1-2 sentences on the people and setting,
>   "challenges": string[] — 3-5 honest trade-offs and difficulties,
>   "questionsToExplore": string[] — 3-5 things the student would need to learn or decide
> }
> ```
>
> *Life seed: {label} — {seed}*
>
> *Student profile (for context, to make the vision feel personal): {profile}*

Where `{brief framing for the type}` is one sentence that tells the LLM which framing this is:

- `current` — *"the student's current trajectory, the most natural extension of what they're already doing"*
- `pivot` — *"a pivot — a different career that uses some of the same skills but heads in a new direction"*
- `wildcard` — *"a wildcard — an unconventional life the student might pursue if money, image, and reputation didn't matter"*

**Parser** validates required fields:
- Throws if `headline` is missing or empty
- Throws if `dayInTheLife` is missing or empty
- Throws if `whoYouWorkWith` is missing or empty
- Coerces missing/non-array `typicalWeek`, `toolsAndSkills`, `challenges`, `questionsToExplore` to `[]` (partial result is better than hard fail)

Low temperature (~0.4) for consistency with occasional creative variance on regenerate.

### `app/api/odysseyElaborate/route.ts`

Thin wrapper. Validates `label` and `seed` non-empty. Builds prompt, calls provider, parses, returns `{ elaboration, trimmed }`.

Token-limit trim-retry: on first failure, trim `jobAdvert` to first 4000 chars. If still failing, trim `resumeText` to first 4000 chars as well. If still failing, returns 500 with *"This life seed is too long to elaborate. Try a shorter description."*

### `app/api/odysseySuggest/route.ts`

Thin wrapper. Builds prompt, calls provider, parses, returns `{ label, description }`. No trim-retry — prompt is small enough that it won't hit limits.

---

## Compare View + Markdown Export

### `OdysseyCompareView`

Shown when the student clicks "Compare all three" on the top bar. Requires at least 2 elaborated lives.

```
[← Back to cards]                                    [Copy as Markdown]

ODYSSEY PLAN — SIDE BY SIDE

┌─ Current Path ──┬─ The Pivot ────┬─ The Wildcard ──┐
│ <elaboration>   │ <elaboration>   │ <elaboration>   │
│ <dashboard R/O> │ <dashboard R/O> │ <dashboard R/O> │
└─────────────────┴─────────────────┴─────────────────┘
```

- Three-column grid on desktop (`md:grid-cols-3 gap-6`), stacks on mobile.
- Each column uses the same `<OdysseyElaboration />` component as the card view, read-only.
- Dashboards render in read-only mode (dots show values, clicks are disabled). Ratings happen on the card view.
- Unelaborated lives show a placeholder panel in their column: *"Life 2 — The Pivot is not yet elaborated. Return to the cards to fill this in."* — so the student sees which slots are incomplete.
- Back button returns to the card view with all state preserved.
- Copy as Markdown button exports all three lives (see below).

### `odysseyPlanToMarkdown()`

New function in `lib/markdown-export.ts`:

```ts
export function odysseyPlanToMarkdown(lives: Record<OdysseyLifeType, OdysseyLife>): string;
```

Output shape:

```markdown
# Odyssey Plan: Three Alternative Lives

## Life 1 — Current Path: Data analyst in a health nonprofit

**Turning research data into decisions that shape patient care.**

### A day in 2030
<paragraph>

### Typical week
- 2 days deep in data cleaning and analysis
- ...

### Tools & skills
- Python + pandas for cleaning and analysis
- ...

### Who you work with
<paragraph>

### Challenges
- Salary ceiling lower than private sector analyst roles
- ...

### Questions to explore
- Does Australia have enough of these roles?
- ...

### How does this feel?
- **Resources:** 3/5 — do I have what I'd need to make this happen?
- **Likability:** 4/5 — do I actually like the sound of this?
- **Confidence:** 2/5 — am I confident I could make it work?
- **Coherence:** 4/5 — does it fit who I'm becoming?

---

## Life 2 — The Pivot: ...
...

---

## Life 3 — The Wildcard: ...
...

---

*AI-generated elaboration. Dashboard ratings are your own reflection.*
```

- **Unelaborated lives** are still included, with the seed if present and a note: *"(This life has not been elaborated yet.)"*. The export reflects the full state of the student's thinking, including what's incomplete.
- **Dashboard values** render as `N/5` with the explanatory question. Null ratings render as `— not yet rated`.
- **AI-generated footer** at the end makes clear the elaborations came from the LLM and the dashboard is the student's reflection.

Both the card view and compare view expose the Copy as Markdown button via the shared `CopyMarkdownButton` component. Identical output regardless of view — the function takes the whole `Record`.

### Tests for `odysseyPlanToMarkdown`

Snapshot-style:

- Full three-life plan, all elaborated, all rated → verify headers, day, week, tools, who, challenges, questions, dashboard values all appear
- One life elaborated, two as seeds only → verify unelaborated lives show the placeholder note
- All three with null dashboard → verify each dashboard line says "— not yet rated"
- Mixed dashboard (some rated, some null) → verify only rated dimensions show numbers
- AI-generated footer appears at the end

---

## Landing integration (ActionsZone regrouping)

### Three labelled sections

`ActionsZone` is refactored from a flat 5-column grid into three labelled sections, each with its own responsive grid.

```
  ─── DISCOVER ───
  [Find my careers]   [Start chatting]

  ─── ASSESS ───
  [Gap analysis]   [Learning path]   [Practice interview]

  ─── REFLECT ───
  [Imagine three lives]
```

Each section header uses the existing `.editorial-rule` Studio Calm class with a new `.justify-center` modifier that adds a mirrored right hairline.

Grids per section:

- **Discover** — `grid-cols-2` (2 buttons, stays 2 wide on mobile)
- **Assess** — `grid-cols-2 md:grid-cols-3` (3 buttons, 2 per row on mobile)
- **Reflect** — `grid-cols-2 md:grid-cols-3` (1 button on ship day; `md:grid-cols-3` leaves room for F12 and F10 without another layout change)

### Handler for "Imagine three lives"

```tsx
async function handleOdyssey() {
  clearMissingHints();
  if (!(await ensureProvider())) return;
  router.push('/odyssey');
}
```

No pre-flight input validation. The Odyssey page has its own per-card validation — students can go to Odyssey with zero inputs and type seeds manually.

### Button styling

```tsx
<Button onClick={handleOdyssey} disabled={anyRunning} variant='outline' className='py-6'>
  <Sparkles className='w-4 h-4 mr-2' />
  Imagine three lives
</Button>
```

Lucide `Sparkles` icon. Label is *"Imagine three lives"* — self-describing for students who've never heard of the DYL framework. The `/odyssey` route name stays as an internal identifier; the UI label is the student-facing version.

### CSS addition

`app/globals.css` gains:

```css
.editorial-rule.justify-center {
  justify-content: center;
}

.editorial-rule.justify-center::after {
  content: '';
  width: 36px;
  height: 1px;
  background: hsl(var(--accent));
  flex-shrink: 0;
}
```

Existing usages of `.editorial-rule` in `app/about/page.tsx` and `app/settings/page.tsx` are unchanged — the new rules only apply when `justify-center` is added as an additional class.

---

## Chat chain integration

### `components/chat/ChatComposer.tsx`

Add optional `onOdyssey?: () => void` prop alongside the existing `onPaperclip?` / `onLookUp?`. When provided, renders a small chain button beside the composer with the label *"Try as Odyssey plan →"*. Disabled flag comes from the parent (`app/chat/page.tsx` passes `disabled={userMessageCount < 3}`).

### `app/chat/page.tsx`

```tsx
async function handleOdyssey() {
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
        guidance: 'Produce a one-to-two sentence aspirational summary suitable as the opening seed for a "Current Path" life in an Odyssey Plan — what the student seems to be heading toward based on this conversation. Write it in first person. Put this in the "background" field.',
        llmConfig,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not distil the chat');
    }
    const { profile } = (await res.json()) as { profile: StudentProfile };
    const seedText = profile.background || '';
    const seedLabel = (profile.goals[0] ?? 'Current path').slice(0, 60);
    store.setOdysseySeed('current', seedLabel, seedText);
    router.push('/odyssey');
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Could not set up Odyssey plan');
  } finally {
    setDistilling(false);
  }
}
```

**Why reuse `/api/distillProfile`:** it already turns a chat transcript into a structured summary. The `guidance` parameter lets us tailor the output shape — we ask for the aspirational summary in the `background` field and use the first `goals` entry as a label. One less route to build.

**Life 1 is the only slot pre-filled.** The student enters `/odyssey`, sees Life 1's seed populated from the chat, and can edit it before elaborating. Lives 2 and 3 stay empty — the student fills them in themselves (or uses Suggest).

**Why not chain Life 2 and Life 3 too:** the Odyssey Plan's pedagogical value is the student's own thinking about their pivot and wildcard. Pre-filling all three from a chat short-circuits the exercise.

### Chain button label

*"Try as Odyssey plan →"* — same arrow pattern as existing chain buttons ("Generate careers from this chat →", "Turn this into a learning path →", "Run gap analysis for this target →").

---

## OutputsBanner integration

`components/landing/OutputsBanner.tsx` adds one more quick-jump link:

```tsx
const hasOdyssey = Object.values(odysseyLives).some(
  (life) => life.seed.trim() || life.headline
);

{hasOdyssey && (
  <Link href='/odyssey' className='underline hover:text-accent'>
    odyssey plan in progress
  </Link>
)}
```

Detection is any-of-three. Even a single seed without elaboration counts as "in progress" — the banner's job is to remind the student that state exists, not to grade completeness.

Label matches the existing "interview in progress" voice. Clicking returns to `/odyssey` with all state preserved.

---

## Error handling

**LLM provider failures.** Both new routes catch errors, return 500 with a message. UI surfaces as toasts.

- **Elaborate failure** → toast *"Could not elaborate this life. Try again."* The card stays in input mode. The seed is preserved.
- **Suggest failure** → toast *"Could not generate a suggestion. Try again or type one yourself."* The card's seed stays whatever it was before.
- **Chat chain failure** → toast *"Could not set up Odyssey plan from this chat. Open the Odyssey page manually from the landing."* Stay on `/chat`. No navigation.

**Token limits.** Trim-and-retry pattern reuses `isTokenLimitError`:

- Elaborate route: first retry trims `jobAdvert` to 4000 chars. Second retry trims `resumeText` to 4000 chars. If still failing: 500 with *"This life seed is too long to elaborate. Try a shorter description."*
- Suggest route: prompt is too small to need trimming; any token-limit error surfaces as a generic 500.

**Parse failures.** `parseOdysseyElaboration` throws on missing `headline`, `dayInTheLife`, or `whoYouWorkWith`. Coerces missing arrays to `[]`. `parseSeedSuggestion` throws on missing `label` or `description`. Route returns 500 on throw; UI toasts *"The AI returned something we couldn't read. Try again — sometimes a second attempt works."*

**Empty seed on elaborate.** Defence-in-depth: the route returns 400 if the seed is empty or whitespace-only. The client-side Elaborate button is disabled in this state.

**No LLM provider configured.** Pre-flight check on every action button (Elaborate, Suggest, Chat chain, landing Odyssey button). Toast + redirect to `/settings`.

**Regenerate preserves dashboard.** Explicit: the confirmation dialog says *"Your dashboard ratings will be kept."*

**Reset clears everything.** Explicit: the confirmation dialog says *"This clears the seed, elaboration, and ratings."*

**Navigate away mid-work.** State lives in the session store. Leaving `/odyssey` and returning restores all seeds, elaborations, and dashboard ratings exactly.

**Reload Electron.** State lost (in-memory only — consistent with the rest of the app).

---

## Testing

### Unit tests (Vitest)

- **`lib/session-store.test.ts`** — extend with: `setOdysseySeed`, `setOdysseyElaboration`, `setOdysseyDashboard`, `resetOdysseyLife`, `reset()` clearing all three odyssey slots.
- **`lib/prompts/odyssey.test.ts`** — `buildOdysseyElaboratePrompt`:
  - Includes the seed, label, and life type
  - Different life types produce visibly different prompt framings
  - Includes profile context when provided
  - Asks for the elaboration JSON shape
  - `parseOdysseyElaboration`:
    - Happy path returns all fields populated
    - Markdown code fences stripped
    - Missing `headline` throws
    - Missing `dayInTheLife` throws
    - Missing `whoYouWorkWith` throws
    - Missing optional arrays coerce to `[]`
- **`lib/prompts/odyssey-suggest.test.ts`** — `buildSeedSuggestionPrompt`:
  - Different life types produce visibly different prompts
  - Includes profile when provided
  - Asks for `{ label, description }` shape
  - `parseSeedSuggestion`:
    - Happy path
    - Markdown code fences stripped
    - Missing `label` throws
    - Missing `description` throws
- **`lib/markdown-export.test.ts`** — extend with `odysseyPlanToMarkdown` snapshot tests:
  - Full three-life plan with all elaborated and rated
  - One elaborated, two as seeds only (placeholder note appears)
  - All null dashboards (each line says "— not yet rated")
  - Mixed dashboard (only rated dimensions show numbers)
  - AI-generated footer appears

### Manual QA checklist

- [ ] Landing shows ActionsZone in three labelled groups (Discover / Assess / Reflect)
- [ ] Reflect row shows "Imagine three lives" button with Sparkles icon
- [ ] Existing 5 buttons still work and are in their correct groups
- [ ] Click "Imagine three lives" → navigates to `/odyssey` with three empty life cards
- [ ] Type a label + seed on Life 1 → click Elaborate → card expands with full elaboration + empty dashboard
- [ ] Click dashboard dots → ratings persist in the store
- [ ] Click a previously selected dot → returns to null
- [ ] Click Regenerate on Life 1 → confirmation → new elaboration replaces old, dashboard ratings preserved
- [ ] Click Reset on Life 1 → confirmation → card goes fully empty including dashboard
- [ ] Click Suggest from profile on an empty Life 1 with populated profile → suggestion fills label + seed; card still unelaborated
- [ ] Click Suggest again on the same card → produces a different suggestion (temperature variance)
- [ ] Click Suggest on Life 2 with existing non-empty seed → confirmation before overwriting
- [ ] Click Suggest with zero profile data → thin suggestion with honest acknowledgement in description
- [ ] Elaborate all three lives → "Compare all three" button enabled
- [ ] Click "Compare all three" → side-by-side view renders all three columns with elaboration + read-only dashboard
- [ ] Click dots in compare view → no effect (dashboard is read-only there)
- [ ] Click "Back to cards" → returns with all state preserved
- [ ] Compare view with only 2 elaborated → third column shows placeholder
- [ ] Copy as Markdown from card view → includes all three lives, headers, day, week, tools, who, challenges, questions, dashboard
- [ ] Copy as Markdown from compare view → identical output
- [ ] Markdown dashboard shows ratings as "N/5" or "— not yet rated"
- [ ] Markdown unelaborated lives show the placeholder note
- [ ] Start over → confirms → all three lives cleared, full session reset
- [ ] In chat, before 3 user messages → "Try as Odyssey plan →" button disabled
- [ ] In chat, after 3 user messages → button enabled
- [ ] Click "Try as Odyssey plan →" → distillation fires, navigates to `/odyssey`, Life 1 is pre-filled from the chat
- [ ] OutputsBanner shows "odyssey plan in progress" when any life has seed or elaboration
- [ ] Clicking the OutputsBanner link returns to `/odyssey`
- [ ] Navigate away mid-work → return → all state preserved
- [ ] Reload Electron → state lost (expected)
- [ ] Simulate token-limit error on elaborate → retry triggers → success or honest failure message
- [ ] Force a parse error on elaborate → toast + card stays editable
- [ ] No LLM provider configured → pre-flight redirect to settings when clicking Elaborate or Suggest
- [ ] Electron dev build works end to end

### Not testing in F11

- Actual LLM elaboration quality (subjective; manual review)
- Prompt effectiveness of the three life type framings (manual review)
- The pedagogical value of the dashboard ratings (that's what shipping is for)

---

## Scope & non-goals

### In scope

- Session store types, fields, actions for three Odyssey life slots
- `lib/prompts/odyssey.ts` with elaborate prompt builder + parser and tests
- `lib/prompts/odyssey-suggest.ts` with suggestion prompt builder + parser and tests
- `lib/markdown-export.ts` extended with `odysseyPlanToMarkdown` and tests
- `app/api/odysseyElaborate/route.ts` with trim-retry
- `app/api/odysseySuggest/route.ts`
- `app/odyssey/page.tsx` orchestrator with card view and compare view toggle
- `components/odyssey/OdysseyLifeCard.tsx`
- `components/odyssey/OdysseyElaboration.tsx`
- `components/odyssey/OdysseyDashboard.tsx`
- `components/odyssey/OdysseyCompareView.tsx`
- `components/landing/ActionsZone.tsx` refactor into Discover / Assess / Reflect groups with Odyssey button in Reflect
- `components/landing/OutputsBanner.tsx` add Odyssey quick-jump link
- `components/chat/ChatComposer.tsx` optional `onOdyssey` prop + chain button
- `app/chat/page.tsx` `handleOdyssey` handler reusing `/api/distillProfile`
- `app/globals.css` `.editorial-rule.justify-center` modifier

### Explicitly out of scope (deferred)

| Deferred | Target |
|---|---|
| F12 Board of Advisors | Separate feature after F11 ships |
| F10 Career Path Comparison | Separate feature after F11 ships; may live on `/careers` rather than landing |
| Grounded Odyssey via web search | Never — imagination work, grounding constrains |
| LLM auto-rating the dashboard | Never — reflection is the student's job |
| Per-life salary/cost estimates | Never — that's gap analysis |
| Per-life learning roadmap | Never — that's learning path |
| PDF export | Later export work |
| Shareable link to an Odyssey plan | Never — offline-first |
| "Suggest all three at once" button | Deferred — single-life suggestion is clearer |
| Pre-populating Life 2 or Life 3 from chat | Never — pedagogical integrity |
| Dashboard history across sessions | Never — no persistence |
| Re-using the same elaboration prompt for other "imagined futures" features | Would need separate brainstorming |

### Carry-forward notes

- F12 Board of Advisors will slot into the Reflect row alongside Imagine three lives. The grouping refactor done here means no layout change is needed.
- F10 Career Comparison may move off the landing entirely and become a "Compare selected" button on the `/careers` spider graph. Decide during F10 brainstorming.
- A future Phase 5 materials feature could feed an `OdysseyLife` into a cover-letter generator — the shape is self-contained enough to reuse.

---

## Open questions

None blocking. Resolved during brainstorming and captured above:

- Feature bundling → F11 alone, not a Phase 4 mega-ship
- Input philosophy → student brainstorms seeds, LLM elaborates; optional "Suggest from profile" for scaffolding
- Life output shape → headline, day, week, tools, who, challenges, questions, student-filled 4-dimension dashboard
- Input flow → per-life cards, independent elaboration, preserve state across regenerates
- Entry points → landing action in REFLECT group + chat chain button; no career card shortcut
- ActionsZone scaling → three labelled groups (Discover / Assess / Reflect); accommodates future F12/F10 without further refactor
- Suggest mechanism → per-click one-LLM-call, different prompts per life type, seed-only (not elaborated), confirmation before overwriting non-empty content
- Compare view → three-column side-by-side, read-only dashboards, placeholder for unelaborated slots
- Markdown export → single function, includes unelaborated lives as placeholders, dashboard as `N/5` or "— not yet rated"
- Chat chain → reuses `/api/distillProfile` with custom guidance; only pre-fills Life 1, never Life 2 or 3
