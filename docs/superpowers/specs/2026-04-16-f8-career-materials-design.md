# F8 — Career Materials (Pitch, Cover Letter, Resume Review)

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Phase reference:** Phase 5 in `docs/phasing-proposal.md`. Shipping pitch + cover letter + resume review now. Portfolio page deferred to its own cycle (F8b).

---

## Summary

F8 ships three career materials that students can produce from their profile and target role:

1. **Elevator Pitch** — a 30-60 second spoken script (hook, body, close) tailored to a target role. Conversational tone, first person.
2. **Cover Letter** — a formal 300-500 word letter tailored to a specific job advert or role. Professional tone. Exportable as DOCX via the `docx` npm package.
3. **Resume Review** — structured feedback on the student's uploaded resume: overall impression, strengths, improvement suggestions with example rewrites, keywords to add, structural notes.

Each material lives at its own route (`/pitch`, `/cover-letter`, `/resume-review`) following the endpoint-owned-inputs pattern. A new **Materials** pillar on the landing page holds all three cards, expanding the grid to four columns on large screens.

The career card dialog's flat button row (now 9+ buttons) is refactored into a grouped dropdown menu.

---

## Design principles (inherited)

- No persistence beyond settings. Materials live in the session store, in-memory only.
- Privacy-first. No grounding — these are personal writing tasks.
- Export, don't save. Copy as Markdown for all three. Save as DOCX for cover letter.
- Reuse before rebuild. Same endpoint-owned-inputs pattern, same prompt builder pattern, same markdown export pattern.
- One LLM call per material.

---

## Architecture

### Routes

- `app/pitch/page.tsx` — elevator pitch endpoint
- `app/cover-letter/page.tsx` — cover letter endpoint
- `app/resume-review/page.tsx` — resume review endpoint

Each follows the three-state pattern:
1. Result exists → render result view
2. No result, required inputs present → auto-run on mount
3. No result, inputs missing → render input card

### Session store additions

New types:

```ts
export type ElevatorPitch = {
  target: string | null;
  hook: string;
  body: string;
  close: string;
  fullScript: string;
};

export type CoverLetter = {
  target: string;
  greeting: string;
  body: string;
  closing: string;
};

export type ResumeReviewItem = {
  section: string;
  suggestion: string;
  why: string;
  example: string;
};

export type ResumeReview = {
  target: string | null;
  overallImpression: string;
  strengths: string[];
  improvements: ResumeReviewItem[];
  keywordsToAdd: string[];
  structuralNotes: string[];
};
```

New fields on `SessionState`:

```ts
elevatorPitch: ElevatorPitch | null;
coverLetter: CoverLetter | null;
resumeReview: ResumeReview | null;
```

New actions: `setElevatorPitch`, `setCoverLetter`, `setResumeReview`. Cleared by `reset()` via `initialState` and by `resetOutputs()`.

### API routes

- `app/api/pitch/route.ts` — thin wrapper, one LLM call, trim-retry
- `app/api/coverLetter/route.ts` — thin wrapper, one LLM call, trim-retry
- `app/api/resumeReview/route.ts` — thin wrapper, one LLM call, trim-retry

### Pure modules

| Path | Responsibility |
|---|---|
| `lib/prompts/pitch.ts` + test | `buildPitchPrompt` + `parsePitch` |
| `lib/prompts/cover-letter.ts` + test | `buildCoverLetterPrompt` + `parseCoverLetter` |
| `lib/prompts/resume-review.ts` + test | `buildResumeReviewPrompt` + `parseResumeReview` |

### New components

| Path | Responsibility |
|---|---|
| `components/pitch/PitchInputCard.tsx` | Input: profile + optional target |
| `components/pitch/PitchResultView.tsx` | Result: hook/body/close sections + Copy as Markdown |
| `components/cover-letter/CoverLetterInputCard.tsx` | Input: profile + target |
| `components/cover-letter/CoverLetterResultView.tsx` | Result: full letter + Copy as Markdown + Save as DOCX |
| `components/cover-letter/cover-letter-docx.ts` | `coverLetterToDocx()` using `docx` package |
| `components/resume-review/ResumeReviewInputCard.tsx` | Input: resume (required) + optional target |
| `components/resume-review/ResumeReviewResultView.tsx` | Result: structured feedback |

### Modified modules

- `lib/session-store.ts` + test — new types, fields, actions
- `lib/markdown-export.ts` + test — `pitchToMarkdown`, `coverLetterToMarkdown`, `resumeReviewToMarkdown`
- `components/landing/ActionCards.tsx` — add Materials pillar, update grid breakpoints
- `components/landing/SessionBanner.tsx` — add output links for three materials
- `components/CareerNode.tsx` — refactor shortcut row to dropdown menu, add pitch + cover letter actions
- `components/results/GapAnalysisView.tsx` — add pitch + cover letter chain buttons
- `components/results/LearningPathView.tsx` — add pitch + cover letter chain buttons
- `package.json` — add `docx` dependency

---

## Landing page — Materials pillar

### Grid update

`ActionCards.tsx` grid changes from `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4`. On large screens: four pillar columns. On medium screens (tablets): two columns (Discover + Assess top row, Reflect + Materials bottom row). On mobile: single column, stacked with pillar headers.

### Hero tagline update

From: "Explore what's possible. Understand what it takes. Reflect on what fits."
To: "Explore what's possible. Understand what it takes. Reflect on what fits. Build what you need."

### Materials pillar cards

```
─── Materials ───
[Elevator pitch]        Write a 30-60 second pitch for networking.
[Cover letter]          Draft a professional letter for applications.
[Resume review]         Get structured feedback on your resume.
```

Icons: `Presentation` (pitch), `FileText` (cover letter), `ClipboardCheck` (resume review) from Lucide.

Each card navigates to its route. No gate — endpoints own their inputs.

---

## Input cards

All follow the endpoint-owned-inputs pattern: show all fields the action can use, pre-filled from store, required fields unmarked, optional fields marked "(optional)".

### PitchInputCard

Fields: Resume (optional), About you (optional), Job title (optional), Job advert (optional).

Helper: "The more you provide, the more tailored the pitch. A target role makes it specific."

Run button: "Write my pitch." No strict gate — the pitch can be generated from minimal input (even just a job title). But at least one field must be non-empty.

### CoverLetterInputCard

Fields: Resume (optional), About you (optional), Job title, Job advert.

Helper: "A cover letter works best with a specific job advert. The more profile detail you provide, the more personalised the letter."

Run button: "Draft cover letter." Gate: at least one of job title or job advert must be non-empty (a cover letter without a target is useless).

### ResumeReviewInputCard

Fields: Resume (required — shown with emphasis, not marked optional), Job title (optional), Job advert (optional).

Helper: "Upload your resume for feedback. Add a target role for tailored suggestions."

Run button: "Review my resume." Gate: resume must be present.

---

## Result views

### PitchResultView

```
────── Elevator Pitch ──────

Your hook
"[Opening line that grabs attention]"

The pitch
[2-3 sentences connecting strengths to the target]

Your close
"[What you're looking for / call to action]"

Full script (ready to practice)
────────────────────────────
[hook + body + close joined as one flowing paragraph]

[Copy as Markdown]
```

The full script section is a bordered block the student can read aloud. Copy as Markdown copies the full script.

### CoverLetterResultView

```
────── Cover Letter ──────

[greeting]

[body - 2-4 paragraphs]

[closing]

[Copy as Markdown]  [Save as DOCX]
```

Rendered as a letter — clean typography, paragraph spacing, no bullet points. The DOCX button saves a properly formatted Word document.

### ResumeReviewResultView

```
────── Resume Review ──────

Overall impression
[2-3 sentences]

What's working
  · strength 1
  · strength 2

Suggested improvements (ordered by impact)
  ┌─ 1. [section] ──────────────────────────────┐
  │ [suggestion]                                  │
  │ Why: [why it matters]                         │
  │ Example: "[rewritten version]"                │
  └───────────────────────────────────────────────┘
  ┌─ 2. [section] ──────────────────────────────┐
  │ ...                                           │
  └───────────────────────────────────────────────┘

Keywords to add (for [target role])
  · keyword 1
  · keyword 2

Structural notes
  · note 1

[Copy as Markdown]
```

Improvements are collapsible cards (same pattern as GapItem in gap analysis). Collapsed shows section + suggestion. Expanded shows why + example.

---

## Prompt details

### Elevator Pitch — `lib/prompts/pitch.ts`

```ts
export type PitchInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type PitchOutput = {
  hook: string;
  body: string;
  close: string;
  fullScript: string;
};

export function buildPitchPrompt(input: PitchInput): string;
export function parsePitch(raw: string): PitchOutput;
```

Prompt asks the LLM for JSON with `{ hook, body, close, fullScript }`. The `fullScript` is the three parts joined naturally as one flowing spoken paragraph. Temperature ~0.6.

Parser validates: all four fields present and non-empty. Strips code fences.

### Cover Letter — `lib/prompts/cover-letter.ts`

```ts
export type CoverLetterInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type CoverLetterOutput = {
  greeting: string;
  body: string;
  closing: string;
};

export function buildCoverLetterPrompt(input: CoverLetterInput): string;
export function parseCoverLetter(raw: string): CoverLetterOutput;
```

Prompt asks for JSON with `{ greeting, body, closing }`. The `body` is the full letter content (multiple paragraphs separated by `\n\n`). Temperature ~0.4.

Parser validates: all three fields present and non-empty.

### Resume Review — `lib/prompts/resume-review.ts`

```ts
export type ResumeReviewInput = {
  resume: string;  // required
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type ResumeReviewOutput = {
  overallImpression: string;
  strengths: string[];
  improvements: ResumeReviewItem[];
  keywordsToAdd: string[];
  structuralNotes: string[];
};

export function buildResumeReviewPrompt(input: ResumeReviewInput): string;
export function parseResumeReview(raw: string): ResumeReviewOutput;
```

Prompt asks for JSON with `{ overallImpression, strengths, improvements, keywordsToAdd, structuralNotes }`. Each improvement has `{ section, suggestion, why, example }`. Temperature ~0.5.

Parser validates: `overallImpression` non-empty, `improvements` is array with at least one item. Coerces missing arrays to `[]`.

---

## DOCX export

### `components/cover-letter/cover-letter-docx.ts`

```ts
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { CoverLetter } from '@/lib/session-store';

export async function coverLetterToDocx(letter: CoverLetter): Promise<Blob> {
  // Build Document with:
  // - Greeting paragraph
  // - Body split by \n\n into separate paragraphs
  // - Closing paragraph
  // Standard business letter formatting: left-aligned, 12pt, single-spaced
  const doc = new Document({ ... });
  return await Packer.toBlob(doc);
}
```

### Save button behaviour

In Electron: `window.electronAPI` exposes a save dialog (or the component uses the existing pattern). The button calls `coverLetterToDocx()`, gets a `Blob`, and triggers download.

In web mode (fallback): create an object URL from the Blob, create a temporary `<a>` element with `download` attribute, click it programmatically.

```tsx
async function handleSaveDocx() {
  const blob = await coverLetterToDocx(coverLetter);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cover-letter-${coverLetter.target.replace(/\s+/g, '-').toLowerCase()}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Cover letter saved as DOCX');
}
```

This works in both Electron and web mode without needing IPC. The browser/Electron's download manager handles the file save dialog.

---

## Markdown export

Three new functions in `lib/markdown-export.ts`:

### `pitchToMarkdown(pitch: ElevatorPitch): string`

```markdown
# Elevator Pitch

**Target:** {target or "General"}

## Your hook
{hook}

## The pitch
{body}

## Your close
{close}

## Full script
{fullScript}

---

*AI-generated pitch. Edit to match your voice before using.*
```

### `coverLetterToMarkdown(letter: CoverLetter): string`

```markdown
# Cover Letter

**Target:** {target}

{greeting}

{body}

{closing}

---

*AI-generated draft. Edit before sending.*
```

### `resumeReviewToMarkdown(review: ResumeReview): string`

```markdown
# Resume Review

**Target:** {target or "General review"}

## Overall impression
{overallImpression}

## What's working
- strength 1
- strength 2

## Suggested improvements

### 1. {section}
**Suggestion:** {suggestion}
**Why:** {why}
**Example:** "{example}"

### 2. {section}
...

## Keywords to add
- keyword 1
- keyword 2

## Structural notes
- note 1

---

*AI-generated feedback. Use as a starting point, not a final verdict.*
```

---

## Career card dropdown refactor

Replace the flat button row in `CareerNode.tsx` dialog with a shadcn `DropdownMenu`. The compare toggle button stays outside the dropdown (it has visible toggle state).

```tsx
<div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4 mt-4'>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant='outline'>
        Actions
        <ChevronDown className='w-4 h-4 ml-2' />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align='end'>
      <DropdownMenuLabel>Discover</DropdownMenuLabel>
      <DropdownMenuItem onClick={handleChatAboutThis}>
        <MessageCircle className='w-4 h-4 mr-2' /> Chat about this role
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => { /* compare toggle */ }}>
        <Columns3 className='w-4 h-4 mr-2' /> Compare this role
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Assess</DropdownMenuLabel>
      <DropdownMenuItem onClick={handleAnalyseGaps}>
        <SearchCheck className='w-4 h-4 mr-2' /> Analyse gaps for this role
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleLearningPath}>
        <RouteIcon className='w-4 h-4 mr-2' /> Learning path for this role
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handlePracticeInterview}>
        <Mic className='w-4 h-4 mr-2' /> Practice interview for this role
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Reflect</DropdownMenuLabel>
      <DropdownMenuItem onClick={handleBoardShortcut}>
        <Users className='w-4 h-4 mr-2' /> Ask the board about this role
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Materials</DropdownMenuLabel>
      <DropdownMenuItem onClick={handleWritePitch}>
        <Presentation className='w-4 h-4 mr-2' /> Write a pitch for this role
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleDraftCoverLetter}>
        <FileText className='w-4 h-4 mr-2' /> Draft a cover letter for this role
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  {/* Compare toggle stays outside — has visible state */}
  <Button variant='outline' size='sm' onClick={handleCompareToggle} ...>
    {inComparison ? <><X /> Remove from comparison</> : <><Columns3 /> Compare this role</>}
  </Button>
</div>
```

Requires `DropdownMenu` components from shadcn. If not already installed, generate them via `npx shadcn-ui@latest add dropdown-menu` or create manually following the existing `dialog.tsx` pattern.

---

## Chain-outs from result views

### GapAnalysisView

Add two chain buttons alongside the existing "Build a learning path" and "Practice interview" chains:

```tsx
<Button variant='outline' onClick={handleWritePitch}>
  <Presentation className='w-4 h-4 mr-2' />
  Write a pitch for this target
</Button>
<Button variant='outline' onClick={handleDraftCoverLetter}>
  <FileText className='w-4 h-4 mr-2' />
  Draft a cover letter for this target
</Button>
```

Handlers:
```ts
function handleWritePitch() {
  store.setElevatorPitch(null);
  router.push('/pitch');
}

function handleDraftCoverLetter() {
  store.setCoverLetter(null);
  router.push('/cover-letter');
}
```

### LearningPathView

Same two chain buttons with the same handlers.

---

## Entry points summary

| From | To | Mechanism |
|------|----|-----------|
| Landing Materials pillar | `/pitch` | ActionCards navigation |
| Landing Materials pillar | `/cover-letter` | ActionCards navigation |
| Landing Materials pillar | `/resume-review` | ActionCards navigation |
| Career card dropdown | `/pitch` | Sets jobTitle, navigates |
| Career card dropdown | `/cover-letter` | Sets jobTitle, navigates |
| Gap analysis result | `/pitch` | Clears pitch, navigates |
| Gap analysis result | `/cover-letter` | Clears cover letter, navigates |
| Learning path result | `/pitch` | Clears pitch, navigates |
| Learning path result | `/cover-letter` | Clears cover letter, navigates |

Resume review has no chain-in from other features — it's a standalone action (reviews YOUR resume, not tied to a career target).

---

## Error handling

Same patterns as every other feature:
- Pre-flight `isLLMConfigured()` check on run + auto-run
- Trim-retry: trim `jobAdvert` → trim `resume` → 500
- Parse failure → toast + input card preserved
- Resume review: resume is required — input card shows upload field prominently, Run button disabled until resume present
- DOCX generation failure → toast "Could not create the document. Copy as Markdown instead."

---

## Testing

### Unit tests (Vitest)

- `lib/session-store.test.ts` — `setElevatorPitch`, `setCoverLetter`, `setResumeReview`, `resetOutputs()` clears all three, `reset()` clears all three
- `lib/prompts/pitch.test.ts` — `buildPitchPrompt` includes profile + target when provided, asks for JSON shape. `parsePitch` happy path, code fences stripped, throws on missing fields.
- `lib/prompts/cover-letter.test.ts` — same pattern
- `lib/prompts/resume-review.test.ts` — same pattern, validates resume is included, improvements have the right shape
- `lib/markdown-export.test.ts` — snapshot tests for all three markdown functions

### Manual QA

- [ ] Landing page shows four pillars: Discover | Assess | Reflect | Materials
- [ ] Grid: `lg:grid-cols-4`, `md:grid-cols-2`, mobile stacks
- [ ] Tagline includes "Build what you need."
- [ ] Materials pillar: Elevator pitch, Cover letter, Resume review cards with correct icons
- [ ] Click Elevator pitch with no inputs → input card with all fields
- [ ] Fill job title → Run → loading → pitch result with hook/body/close/full script
- [ ] Copy as Markdown → includes all sections + footer
- [ ] Click Cover letter with no inputs → input card with all fields
- [ ] Fill job title or job advert → Run → loading → cover letter result
- [ ] Save as DOCX → file downloads as .docx, opens in Word/Google Docs
- [ ] Copy as Markdown → full letter
- [ ] Click Resume review with no resume → input card, Run button disabled, resume upload prominent
- [ ] Upload resume → Run enables → click → loading → review with impressions, strengths, improvements
- [ ] Improvements are collapsible (collapsed: section + suggestion, expanded: why + example)
- [ ] Copy as Markdown → includes all sections
- [ ] Career card dialog: shortcut buttons replaced by "Actions" dropdown + compare toggle
- [ ] Dropdown has grouped sections (Discover / Assess / Reflect / Materials)
- [ ] "Write a pitch for this role" from dropdown → /pitch with job title pre-filled
- [ ] "Draft a cover letter for this role" from dropdown → /cover-letter with job title pre-filled
- [ ] Gap analysis result: "Write a pitch" and "Draft a cover letter" chain buttons visible
- [ ] Learning path result: same chain buttons
- [ ] SessionBanner shows "pitch ready", "cover letter ready", "resume review ready" links
- [ ] Start over clears all three materials
- [ ] Auto-run: navigate to /pitch with job title + resume in store → pitch generates automatically
- [ ] Electron dev build end to end

---

## Scope

### In scope
- Session store types + fields + actions for pitch, cover letter, resume review
- Three prompt builders + parsers with TDD
- Three markdown exporters with TDD
- Three API routes with trim-retry
- Three endpoint pages (input card + auto-run + result view)
- `coverLetterToDocx()` with `docx` package
- Materials pillar on landing with responsive grid update
- Hero tagline update
- Career card dropdown refactor (replaces flat button row)
- Career card pitch + cover letter shortcuts in dropdown
- Gap analysis + learning path chain buttons for pitch + cover letter
- SessionBanner output links

### Out of scope
- Portfolio page (F8b, own cycle with HTML generation + iframe preview + file save)
- PDF export (students print-to-PDF from Word)
- Resume rewriting (we give suggestions, not a new resume)
- Grounding (personal writing, not market research)
- Chat chain for materials (low value — chat doesn't have enough structured context)

### Carry-forward
- Portfolio page (F8b) will be the fourth card in the Materials pillar. The grid already has room.
- F15 Career Story / Narrative Builder is a separate Phase 5 feature, not part of F8.
- F16 Export / Report Generation is a separate feature for comprehensive export (PDF, image, full report).
