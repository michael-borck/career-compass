# Phase 2 — Gap Analysis, Learning Path, and the Unified Inputs+Actions Landing

**Date:** 2026-04-13
**Status:** Design approved — ready for implementation plan
**Phase reference:** `docs/phasing-proposal.md` Phase 2, reshaped by `docs/phase2-unified-inputs-proposal.md`
**Supersedes for Phase 2 landing work:** the two-card landing from Phase 1

---

## Summary

Phase 2 delivers three new capabilities and one landing-page redesign that unifies them with Phase 1:

1. **F4 — Job Advert Reverse Workflow.** A new `jobAdvert` input lets students paste a job posting and use it as a target for any action.
2. **F7 — Resume Gap Analysis.** `/gap-analysis` compares the student's profile against a target (job advert or job title or career card) and returns structured gaps with severity, target level, current level, and evidence ideas.
3. **F9 — Learning Path Generator.** `/learning-path` produces a week-by-week roadmap to a target role, optionally personalised by a profile and optionally chained from gap analysis results for focused priorities.

The landing page collapses Phase 1's two-card model (Upload & Explore, Chat with an Advisor) into a single unified surface: a shared **Inputs zone** (resume, job title, about you, job advert) and an **Actions zone** with four first-class actions (Find my careers, Start chatting, Gap analysis, Learning path). Every action reads from the shared inputs; students never re-enter data to try a new flow.

---

## Design principles (inherited, unchanged)

- No persistence beyond settings. In-memory session only.
- No database.
- Export, don't save — and Phase 2 introduces the first concrete export: Copy as Markdown on both output pages.
- Flexible input — any combination of resume, job title, about you, job advert.
- Privacy-first: local file processing, LLM API calls are the only external traffic.

---

## Architecture

### Session store additions

New fields on `SessionState` in `lib/session-store.ts`:

```ts
type SessionState = {
  // ... existing Phase 1 fields ...

  // New Phase 2 input
  jobAdvert: string;

  // New Phase 2 outputs
  gapAnalysis: GapAnalysis | null;
  learningPath: LearningPath | null;

  // New actions
  setJobAdvert: (text: string) => void;
  setGapAnalysis: (g: GapAnalysis | null) => void;
  setLearningPath: (l: LearningPath | null) => void;
};
```

`reset()` clears these alongside the existing Phase 1 fields. Initial state: `jobAdvert: ''`, `gapAnalysis: null`, `learningPath: null`.

### Types

Defined in `lib/session-store.ts` (kept with the store since they're store shape):

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
  target: string;        // role name or truncated first line of job advert
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

### Routes

Two new pages and two new API routes:

- `app/gap-analysis/page.tsx` — renders `<GapAnalysisView />` from store
- `app/learning-path/page.tsx` — renders `<LearningPathView />` from store
- `app/api/gapAnalysis/route.ts` — thin wrapper over LLM provider
- `app/api/learningPath/route.ts` — thin wrapper over LLM provider

### New pure modules

- `lib/prompts/gaps.ts` — `buildGapAnalysisPrompt`, `parseGapAnalysis`
- `lib/prompts/learningPath.ts` — `buildLearningPathPrompt`, `parseLearningPath`
- `lib/profile-text.ts` — `profileToReadableText(profile)` for pre-filling "About you"
- `lib/markdown-export.ts` — `gapAnalysisToMarkdown(g)`, `learningPathToMarkdown(l)`

### Updated modules

- `lib/prompts/careers.ts` — `CareersInput` type gains `jobAdvert?: string`; `buildCareersPrompt` appends `<jobAdvert>` section; `buildCareerDetailPrompt` includes it in the context block.
- `app/api/getCareers/route.ts` — passes through the new field. No structural change beyond the type.
- `app/api/chat/route.ts` — `buildContextBlock` gains `jobAdvert` as another optional section. Same pattern as `resumeText`/`freeText`/`jobTitle`.

### New landing components

- `components/landing/InputsZone.tsx` — 4 inputs bound directly to session store
- `components/landing/ActionsZone.tsx` — 4 action buttons with missing-input checking
- `components/landing/OutputsBanner.tsx` — replaces `SessionBanner`; shows what outputs exist with quick-jump links

### Deleted / collapsed

- `components/landing/UploadCard.tsx` — functionality moves into `InputsZone` + `ActionsZone`
- `components/landing/ChatCard.tsx` — same; also drops the "first chat message" textarea entirely
- `components/landing/SessionBanner.tsx` — replaced by `OutputsBanner.tsx`
- The `pendingChatMessage` field on session store — no longer needed; Start Chatting just opens chat with shared inputs as context

### New output components

- `components/results/GapAnalysisView.tsx`
- `components/results/LearningPathView.tsx`
- `components/results/GapItem.tsx` — collapsible gap row
- `components/results/MilestoneItem.tsx` — collapsible milestone row
- `components/results/CopyMarkdownButton.tsx` — shared between both output views

### Career card update

`components/CareerNode.tsx` gains two new buttons in its dialog footer alongside the existing "Chat about this":

- **Analyse gaps for this role** → sets `jobTitle`, calls `/api/gapAnalysis` with current profile inputs, navigates to `/gap-analysis`
- **Learning path for this role** → same pattern for `/api/learningPath` and `/learning-path`

---

## Landing page

### Layout

```
HERO  (unchanged from Phase 1 polish — slim title, italic accent, tagline)

OUTPUTS BANNER  (only when at least one output exists)
  You have: 6 careers · 3 chat messages · gap analysis ready   [Start over]

INPUTS ZONE  (2-col grid on md+, stacks on narrow)
  ┌────────────────────────┐  ┌────────────────────────┐
  │ Resume (drop zone)     │  │ Job title (input)      │
  └────────────────────────┘  └────────────────────────┘
  ┌────────────────────────┐  ┌────────────────────────┐
  │ About you (textarea)   │  │ Job advert (textarea)  │
  └────────────────────────┘  └────────────────────────┘

ACTIONS ZONE  (single row on md+, 2x2 on narrow)
  [ Find my careers ] [ Start chatting ] [ Gap analysis ] [ Learning path ]
```

### Inputs

Each input binds directly to the session store via `useSessionStore`:

| Input | Store field | Component |
|---|---|---|
| Resume | `resumeText`, `resumeFilename` | `LocalFileUpload` (reused from Phase 1) |
| Job title | `jobTitle` | `Input` |
| About you | `freeText` | `Textarea`, rows=4 |
| Job advert | `jobAdvert` (new) | `Textarea`, rows=6 |

No local component state for input content. Navigating away and back preserves values naturally.

**"About you" pre-fill from distilled profile:** when `distilledProfile` exists and `freeText` is empty on mount, call `profileToReadableText(distilledProfile)` and pre-fill `freeText` with the result. A small hint renders above the textarea: *"Pre-filled from your advisor chat. Edit freely."* The pre-fill only happens once per mount; after that, the field is the student's to edit. The underlying `distilledProfile` JSON is never overwritten.

### Actions

Each action has a pre-flight check. If the check fails, the button is **still clickable** — clicking triggers **inline missing-input prompting** rather than a disabled state. Missing fields get a soft accent-coloured outline and a hint appears above them, like *"Gap analysis needs a job. Paste a job advert or enter a job title."* The first missing field is focused and scrolled into view. Hints clear on next keystroke in the highlighted field.

| Action | Check |
|---|---|
| Find my careers | At least one of `{resumeText, jobTitle, freeText, jobAdvert}` is non-empty |
| Start chatting | None — always enabled |
| Gap analysis | `(jobAdvert OR jobTitle)` AND `(resumeText OR freeText OR distilledProfile)` |
| Learning path | `jobAdvert OR jobTitle` |

When the check passes:

- **Find my careers** → navigate to `/careers` (Phase 1 flow unchanged). The `getCareers` route now also receives `jobAdvert` and threads it through the prompt builder.
- **Start chatting** → navigate to `/chat` (Phase 1 flow unchanged). All shared inputs pass as context via the existing `resumeText`/`freeText`/`jobTitle` mechanism. `jobAdvert` is added to the chat route's context block alongside them.
- **Gap analysis** → set a page-level `runningAction` state (disables all four action buttons + shows a small inline spinner next to the clicked button), call `/api/gapAnalysis` with the current inputs, on success `setGapAnalysis(result)` and navigate to `/gap-analysis`. On failure, toast error and clear `runningAction`.
- **Learning path** → same pattern, `/api/learningPath`, navigate to `/learning-path`.

The `runningAction` state is local to the Actions zone, not in the session store (it's transient UI state). Only one action can run at a time; attempting to click a second action while one is running is a no-op.

### OutputsBanner

Shown on landing only when at least one output exists in the store. Lists whatever's present:

- `careers !== null && careers.length > 0` → "6 careers"
- `chatMessages` contains any user messages → "3 chat messages"
- `gapAnalysis !== null` → "gap analysis ready"
- `learningPath !== null` → "learning path ready"

Each label is a link to its respective route. "Start over" resets the entire store after a confirmation dialog.

The banner does not signal input state — inputs are always visible below it, so "you have inputs" is obvious from looking at the page.

---

## Gap Analysis

### API route `app/api/gapAnalysis/route.ts`

```ts
interface GapAnalysisRequest {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  llmConfig?: LLMConfig;
}
```

Defence-in-depth validation: route returns 400 if no target (jobAdvert or jobTitle) or no profile (resume or aboutYou or distilledProfile). This catches direct API callers; the landing's pre-flight check catches the normal case first.

Builds the prompt, calls the provider, parses into `GapAnalysis`, returns `{ analysis, trimmed }`. Token-limit retry trims `jobAdvert` to the first 4000 characters; if still failing, returns an error message telling the student to shorten the advert manually.

### Prompt builder `lib/prompts/gaps.ts`

```ts
export type GapAnalysisInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
};

export function buildGapAnalysisPrompt(input: GapAnalysisInput): string;
export function parseGapAnalysis(raw: string): GapAnalysis;
```

The prompt:

- System message: *"You are a career gap analyst. Read the target role and the student's profile. Identify specific gaps. Be honest but encouraging — always call out what the student already has. Never fabricate specific course names, URLs, certifications, or pricing. Describe types of evidence, not named products."*
- User message: structured sections. `<target>` is populated from `jobAdvert` if present, else from `jobTitle`. `<profile>` combines resume, aboutYou, and a formatted `distilledProfile` if present. Explicit JSON schema matching the `GapAnalysis` type.
- Temperature: 0.3.

`parseGapAnalysis` strips markdown code fences, parses JSON, validates required fields (`summary`, `gaps` non-empty, each gap has `title`/`category`/`severity`/`why`/`targetLevel`/`evidenceIdeas`). Nullable `currentLevel`. Missing `matches` coerced to empty array. Throws on missing `summary` or empty `gaps`.

### Page `app/gap-analysis/page.tsx`

Reads `gapAnalysis` from store. Empty state if null: *"No analysis yet."* + Back to start link.

When present, renders `<GapAnalysisView />`:

```
← Back           [Copy as Markdown]  [Start over]

Gap analysis
vs Data Analyst

Summary
  <paragraph>

What you already have ✓
  · SQL basics (from resume)
  · Stats background (from chat)
  · Communication experience

Gaps                                   [Show all details]

  [CRITICAL] Intermediate SQL                                 ▸
  [CRITICAL] Portfolio with real data                         ▸
  [IMPORTANT] Tableau or PowerBI familiarity                  ▸
  [NICE]     Industry-specific domain knowledge               ▸

Rough timeline: 3-6 months with focused effort
(AI estimate — verify against your own situation)

[Turn this into a learning path →]
```

Each gap row is a click target. Click expands inline to show `targetLevel`, `currentLevel` (if present), and `evidenceIdeas` as bullets. "Show all details" toggles every row at once (local component state, not persisted).

Severity badges use existing Studio Calm tokens: critical = `text-error`, important = `text-accent`, nice-to-have = `text-ink-muted`.

**"Turn this into a learning path →"** call `/api/learningPath` with the current `gapAnalysis` as `gapChain` extra context. Inline loading state. On success, `setLearningPath(result)` and navigate to `/learning-path`.

### Copy as Markdown

`gapAnalysisToMarkdown(g: GapAnalysis): string` in `lib/markdown-export.ts`. Output:

```markdown
# Gap Analysis: Data Analyst

<summary paragraph>

## What you already have
- SQL basics (from resume)
- Stats background (from chat)
- Communication experience

## Gaps

### [CRITICAL] Intermediate SQL
**Why it matters:** ...
**Target level:** Able to write joins, window functions, CTEs
**Current level:** Basic SELECT/WHERE/GROUP BY
**How to demonstrate:**
- SQL-backed portfolio project with real data
- Contribute to an open data project
- Complete an intermediate SQL course

### [CRITICAL] Portfolio with real data
...

## Rough timeline
3-6 months with focused effort

*AI-generated. Verify suggestions against your own situation.*
```

`CopyMarkdownButton` writes to clipboard via `navigator.clipboard.writeText` and toasts *"Copied."* on success. Exports always include full detail regardless of UI expand state.

---

## Learning Path

### API route `app/api/learningPath/route.ts`

```ts
interface LearningPathRequest {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  gapAnalysis?: GapAnalysis;  // optional chain seed
  llmConfig?: LLMConfig;
}
```

Returns 400 if no target. Same trim-and-retry pattern on token limits (trims `jobAdvert` first). Returns `{ path, trimmed }`.

### Prompt builder `lib/prompts/learningPath.ts`

```ts
export type LearningPathInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  gapAnalysis?: GapAnalysis;
};

export function buildLearningPathPrompt(input: LearningPathInput): string;
export function parseLearningPath(raw: string): LearningPath;
```

Prompt:

- System: *"You are a career learning-path designer. Given a target role (and optionally a student profile and gap list), produce a structured week-by-week learning path. Milestones must be concrete. Be honest about AI limits — never fabricate specific course URLs, certification names, or pricing. Suggest the type of resource ('an intermediate SQL course on a major platform') not a specific one unless it is widely known (e.g., 'Google Data Analytics Certificate'). Always include caveats."*
- User: sections. Always `<target>`. Optionally `<profile>`, `<gapAnalysis>`. When `gapAnalysis` is present, prompt text explicitly says *"Prioritise the following gaps in the earliest milestones."* Explicit JSON shape.
- Temperature: 0.3.

`parseLearningPath` validates `summary`, `milestones` non-empty, `totalDuration`. Each milestone must have `weekRange`, `focus`, `activities` (array), `outcome`. Tolerates missing `prerequisites`, `portfolioProject`, `caveats` (coerced to empty). Throws only if `milestones` missing or empty.

### Page `app/learning-path/page.tsx`

`<LearningPathView />` layout:

```
← Back           [Copy as Markdown]  [Start over]

Learning path to Data Analyst

Summary
  <paragraph>

Total duration: 12 weeks

Caveats
  · AI-generated suggestions — verify course availability
  · Timeline assumes ~10 hrs/week

Before you start
  · Comfortable with basic arithmetic and logic
  · A computer with internet access
  · 10 hours per week of focused study

Milestones                             [Show all details]

  Weeks 1-2 · Python basics + SQL refresher           ▸
  Weeks 3-4 · Data cleaning with pandas               ▸
  Weeks 5-6 · Visualisation + Tableau                 ▸
  Weeks 7-10 · Build the portfolio project            ▸
  Weeks 11-12 · Polish, interview prep                ▸

  ─────────────────────────────────────────────
  📂 Portfolio project
  <project description>
  ─────────────────────────────────────────────

[Run gap analysis for this target →]
```

Each milestone is a click target that expands inline to show `activities` and `outcome`. "Show all details" flips all milestones.

**Portfolio project** gets its own highlighted box below the milestones — it's often the most motivating part and deserves visual weight.

**Caveats** render as a compact bullet list under the total duration, always visible. Students should see them before committing.

**"Run gap analysis for this target →"** — reverse chain. Only visible if a profile exists (resume OR freeText OR distilledProfile). Calls `/api/gapAnalysis`, navigates to `/gap-analysis` on success.

### Copy as Markdown

`learningPathToMarkdown(p: LearningPath): string`:

```markdown
# Learning Path: Data Analyst

<summary paragraph>

**Total duration:** 12 weeks

## Before you start
- Comfortable with basic arithmetic and logic
- A computer with internet access
- 10 hours per week of focused study

## Milestones

### Weeks 1-2 · Python basics + SQL refresher
**Activities:**
- Complete freeCodeCamp Python 1-3
- Refresh SQL SELECT, WHERE, GROUP BY
- Practice 20 problems on a SQL training site

**Outcome:** Comfortable writing basic Python scripts and SQL queries.

### Weeks 3-4 · Data cleaning with pandas
...

## Portfolio project
Build an end-to-end dashboard analysing a public dataset you care
about. Document your SQL queries, cleaning steps, visualisations,
and a short write-up.

## Caveats
- AI-generated suggestions — verify course availability
- Timeline assumes ~10 hrs/week

*AI-generated. Treat specific course names as starting points, not final recommendations.*
```

---

## Phase 1 integration

### Pre-fill "About you" from distilled profile

`lib/profile-text.ts`:

```ts
export function profileToReadableText(p: StudentProfile): string;
```

Composes a paragraph from the five profile fields. Example output:

> I'm a final-year business student from Perth with a background in marketing. I'm interested in data analysis, teaching, and behavioural research. My skills include SQL basics, Excel, and giving presentations. I'm limited to remote work for now. I aim to land a data role in Australia within 12 months.

The function handles partial profiles gracefully: empty arrays are skipped rather than producing "My skills include ." sentences.

`InputsZone` checks on mount:
- If `distilledProfile` exists AND `freeText` is empty → call `profileToReadableText` and `store.setFreeText(result)`
- Render a hint above the textarea: *"Pre-filled from your advisor chat. Edit freely."*
- Hint disappears once the textarea is edited (track via a local `edited` state flag)

The underlying `distilledProfile` JSON is never overwritten. If the student edits the textarea, their version lives in `freeText`; the structured profile remains the canonical shape consumed by `getCareers`.

### Career card shortcuts

`components/CareerNode.tsx` dialog footer gains two buttons alongside Phase 1's "Chat about this":

```tsx
<div className='flex justify-end gap-3 border-t border-border pt-4 mt-4'>
  <Button variant='outline' onClick={handleChatAboutThis}>
    <MessageCircle /> Chat about this
  </Button>
  <Button variant='outline' onClick={handleAnalyseGaps} disabled={running}>
    <SearchCheck /> Analyse gaps for this role
  </Button>
  <Button variant='outline' onClick={handleLearningPath} disabled={running}>
    <Route /> Learning path for this role
  </Button>
</div>
```

Both new handlers:
1. Write `jobTitle` to the store with the career's title
2. Set a local `running` state (disables all footer buttons during the fetch)
3. Call the relevant API route with the current inputs from the store
4. On success: write result to store, navigate
5. On failure: toast error, stay on the spider graph

Gap analysis from a card runs even if the profile is thin. The prompt instructs the LLM to add a note in the summary when the profile is limited ("Profile is limited — add a resume or chat with the advisor for a richer analysis"). This is opportunistic: richer inputs → richer outputs, empty inputs → honest thin output.

### Dropped

- **`pendingChatMessage` field on session store.** The field, its setter, and the Phase 1 auto-send-on-mount effect in `app/chat/page.tsx` all go away. Start Chatting from landing just navigates to `/chat` with no first-message staging; whatever's in the shared inputs (resume / jobTitle / freeText / jobAdvert) passes as context via the chat route's `buildContextBlock`.
- **`SessionBanner.tsx`** (replaced by `OutputsBanner.tsx`).
- **`UploadCard.tsx`, `ChatCard.tsx`** (collapsed into `InputsZone` + `ActionsZone`).

---

## Error handling

**LLM provider failures.** Both new routes reuse the Phase 1 error pattern: catch errors, log, return 500 with a message. The UI toasts the error and stays on landing (or output page).

**Token limits.** Both routes use trim-and-retry:

1. First attempt: full inputs
2. On `isTokenLimitError` (reuses the Phase 1 helper, promoted to `lib/token-limit.ts` for reuse): truncate `jobAdvert` to the first 4000 chars, retry
3. If still failing: return a 500 with the message *"Your job advert is too long even after trimming. Try pasting just the role, requirements, and responsibilities sections."*

`resume` is only trimmed in step 3 as a last resort.

**Parse failures.** If the LLM returns unparseable JSON or misses required fields, the parser throws. The route returns 500 with a message. The UI toasts *"The AI returned something we couldn't read. Try again — sometimes a second attempt works."*

**Missing inputs at API layer.** Routes defensively return 400 when called without the required target/profile. The landing's pre-flight catches this first for normal flows; defence-in-depth catches direct or chained calls.

**No provider configured.** Same as Phase 1 — toast + redirect to `/settings` from the landing page before calling any route.

**Stale focus + chained navigation.** If a student runs gap analysis on one target, then edits `jobTitle` and runs again, the store simply overwrites. No special handling needed. Navigating between output pages and back preserves results.

---

## Testing

### Unit tests (Vitest)

- `lib/session-store.test.ts` — extend with new actions: `setJobAdvert`, `setGapAnalysis`, `setLearningPath`, and `reset()` clearing all new fields.
- `lib/prompts/gaps.test.ts` — `buildGapAnalysisPrompt` with target-only, target+resume, target+aboutYou, target+distilledProfile, all combined; `parseGapAnalysis` for happy path, markdown code fences, missing fields (throws), nullable `currentLevel`, `matches` coerced to empty array.
- `lib/prompts/learningPath.test.ts` — similar structure, plus a case for `gapAnalysis` chain seed in the prompt output.
- `lib/profile-text.test.ts` — `profileToReadableText` for full profiles, profiles with empty arrays, profiles with only `background` set.
- `lib/markdown-export.test.ts` — `gapAnalysisToMarkdown` and `learningPathToMarkdown` snapshot tests.
- `lib/prompts/careers.test.ts` — add a test that `buildCareersPrompt` includes `jobAdvert` when provided.
- `lib/token-limit.test.ts` — extract and unit-test `isTokenLimitError` (currently duplicated inline in `/api/chat` and `/api/distillProfile`; promote to a shared helper).

### Manual QA checklist

- [ ] Landing: empty session, all 4 inputs visible, 4 action buttons visible
- [ ] Type a job title only, click Gap analysis → inline hint prompts for a profile
- [ ] Add a resume, click Gap analysis → runs, navigates to `/gap-analysis`
- [ ] Gap analysis page renders summary, matches, gap list with severity badges
- [ ] Expand a single gap row → target level, current level, evidence ideas visible
- [ ] "Show all details" toggle expands every gap
- [ ] Copy as Markdown → paste into notes/email, verify readable
- [ ] "Turn this into a learning path" → spinner, navigates to `/learning-path`
- [ ] Learning path page renders summary, caveats, prerequisites, milestones, portfolio project
- [ ] Expand a milestone → activities and outcome visible
- [ ] Run learning path standalone from landing with just a job title → renders (no personalisation caveat notable)
- [ ] Run learning path with job title + resume → personalisation visible in summary
- [ ] "Run gap analysis for this target" from learning path → works when profile exists
- [ ] Career card → "Analyse gaps for this role" → runs directly, navigates
- [ ] Career card → "Learning path for this role" → runs directly, navigates
- [ ] Distilled profile present → About you pre-filled with paragraph, hint visible
- [ ] Edit About you → hint disappears
- [ ] OutputsBanner shows all four output labels when all are populated, each links correctly
- [ ] Start over from landing → confirms, clears store, banner disappears
- [ ] Simulate token-limit error on huge job advert → trim retry triggers (add diagnostic log like Phase 1)
- [ ] Paste-then-edit an input, click action, verify stored value is used
- [ ] Navigate chat → landing → gap analysis round trip, inputs persist throughout
- [ ] Electron dev build works end to end (`npm run electron:dev`)

### Not testing in Phase 2

- Actual LLM output quality (subjective, manual review)
- Search-grounded course name accuracy (Phase 3 concern)
- Persistence across app restarts (never — violates principle)

---

## Scope & non-goals

### In scope

- `jobAdvert` as a new input on the session store and landing
- `/api/gapAnalysis` route, prompt builder, parser, types
- `/api/learningPath` route, prompt builder, parser, types
- `/gap-analysis` and `/learning-path` pages with collapsible detail
- Copy as Markdown on both output pages
- Landing redesign: Inputs zone + Actions zone, replacing UploadCard + ChatCard
- OutputsBanner replacing SessionBanner
- "About you" pre-fill from distilled profile
- Career card shortcut buttons (gap analysis + learning path, alongside Phase 1's chat-about-this)
- Chaining: gap analysis → learning path, and learning path → gap analysis
- `buildCareersPrompt` updated to accept `jobAdvert`
- `buildContextBlock` in chat route updated to accept `jobAdvert`
- Promote `isTokenLimitError` to a shared helper
- Unit tests for all new pure modules
- Manual QA checklist

### Explicitly out of scope (deferred)

| Deferred | Target |
|---|---|
| Real course URLs, pricing, availability (search-grounded) | Phase 3 |
| SFIA / O*NET / ESCO framework mapping | Phase 6 |
| Interview role-play (F14) | Revisit after Phase 2 ships |
| Career path comparison (F10) | Phase 4 |
| Pitch deck / materials generated from gap or learning path results | Phase 5 |
| PDF export | Phase 5 |
| Persistence across app restarts | Never (violates principle) |
| Automatic injection of `gapAnalysis` / `learningPath` into the chat route's context block | Trivial follow-up after Phase 2 if desired; not blocking |
| Batch "run gap analysis for all 6 career cards at once" | Out of scope — adds complexity for marginal value |

### Phasing notes to carry forward

- F14 (Interview Role-Play) placement after Phase 2 still looks right; the combination of chat + gap analysis + learning path makes interview practice the obvious next tool.
- Phase 3 (web search grounding) will retroactively upgrade learning path quality by replacing "an intermediate SQL course on a major platform" with specific verifiable course names and links.
- The unified inputs+actions landing introduced here makes Phase 3 (URL input) trivial: add a `url` input field and the same action buttons pick it up.

---

## Open questions

None blocking. The following are resolved and captured above:

- Landing model → unified inputs + actions, replacing the two-card layout.
- Output surfaces → dedicated routes `/gap-analysis` and `/learning-path`, not modals or inline.
- Gap structure → rich JSON (Q4) with UI-level progressive disclosure for detail.
- Learning path structure → week-based milestones + portfolio project + caveats + prerequisites.
- Phase 1 integration → A (pre-fill About you + OutputsBanner) and B (career card shortcuts).
- Missing-input UX → inline highlight + hint, buttons never hard-disabled.
- Copy format → Markdown, full detail regardless of UI state, clipboard via `navigator.clipboard`.
- Token-limit fallback → trim `jobAdvert` first, then `resume`, error on second failure.
