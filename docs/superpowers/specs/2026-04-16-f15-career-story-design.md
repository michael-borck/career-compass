# F15 — Career Story / Narrative Builder

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Phase reference:** Phase 5 in `docs/phasing-proposal.md`. The capstone reflection feature — draws on the full session to find themes and write a narrative.

---

## Summary

F15 generates a career story from the student's full session data. The LLM reads everything the student has produced — resume, profile, generated careers, gap analysis, learning path, board review, Odyssey lives, comparison, pitch, cover letter, resume review — and identifies 3-5 recurring themes that connect their experiences, then weaves those themes into a 2-4 paragraph first-person narrative.

The pedagogical value comes from Career Construction Theory (Savickas): people make sense of their careers by constructing a narrative that connects past, present, and future. The feature names the patterns the student might not have seen themselves. The practical value: the narrative is usable in "Tell me about yourself" interviews, personal statements, and grad school applications.

This is the capstone — it gets richer as the student uses more of the app. A student with just a resume gets a thin story. A student who has chatted, generated careers, run gap analysis, imagined three Odyssey lives, and received board feedback gets a rich, multi-layered narrative.

---

## Design principles (inherited)

- No persistence beyond settings. Career story lives in the session store, in-memory only.
- Privacy-first. No grounding — this is personal synthesis.
- Export as DOCX (primary) and Markdown (secondary).
- The more session data available, the better the output. Honest about this in the UI.

---

## Architecture

### Route

`app/career-story/page.tsx` — follows the endpoint-owned-inputs pattern:
1. Has result → render narrative + themes
2. No result, has required inputs → auto-run on mount
3. No result, missing inputs → render input card

### Session store additions

```ts
export type CareerTheme = {
  name: string;
  evidence: string[];
  reflectionQuestion: string;
};

export type CareerStory = {
  themes: CareerTheme[];
  narrative: string;
};
```

Field: `careerStory: CareerStory | null`
Action: `setCareerStory: (s: CareerStory | null) => void`
Cleared by `reset()` and `resetOutputs()` via `initialState`.

### API route

`app/api/careerStory/route.ts` — thin wrapper. Accepts all profile fields plus the full session outputs as context. One LLM call. Returns `{ story: { themes, narrative }, trimmed }`.

Trim-retry strategy differs from other routes: trim session outputs first (they're context, not primary material), then jobAdvert, then resume. This preserves the resume (the richest single source) as long as possible.

### Pure module

`lib/prompts/career-story.ts` — `buildCareerStoryPrompt(input)` + `parseCareerStory(raw)`.

`lib/prompts/career-story.test.ts` — unit tests.

### Components

- `components/career-story/CareerStoryInputCard.tsx` — input card with profile fields + helper note
- `components/career-story/CareerStoryResultView.tsx` — narrative + themes
- `components/career-story/career-story-docx.ts` — `careerStoryToDocx()` using `docx` package

---

## Input card

`CareerStoryInputCard` follows the endpoint-owned-inputs pattern.

Fields: Resume (LocalFileUpload), About you (Textarea), Job title (optional), Job advert (optional). All pre-filled from store, always visible.

Helper note (prominent, styled like the compare "quick is vague" helper):

> *"This works best when you've explored other features first. The career story draws on everything in your session: your generated careers, gap analysis, Odyssey lives, board review, and more. The more you've done, the richer the story."*

Run button: "Build my career story" with `BookOpen` icon. Gate: at least one of resume or freeText (same as portfolio).

On run: POST `/api/careerStory` with profile fields + all session outputs. On success: `store.setCareerStory(story)`.

---

## The prompt

### `lib/prompts/career-story.ts`

```ts
export type CareerStoryInput = {
  // Profile (primary)
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
  // Session outputs (context — more = richer)
  careers?: finalCareerInfo[];
  gapAnalysis?: GapAnalysis;
  learningPath?: LearningPath;
  boardReview?: BoardReview;
  odysseyLives?: Record<OdysseyLifeType, OdysseyLife>;
  comparison?: Comparison;
  elevatorPitch?: ElevatorPitch;
  coverLetter?: CoverLetter;
  resumeReview?: ResumeReview;
  interviewFeedback?: InterviewFeedback;
};

export function buildCareerStoryPrompt(input: CareerStoryInput): string;
export function parseCareerStory(raw: string): { themes: CareerTheme[]; narrative: string };
```

Prompt body:

> You are helping a student discover the narrative thread that connects their experiences, interests, and goals. This is a Career Construction Theory exercise — the student may not see the patterns in their own history, and your job is to name them.
>
> Read ALL of the student's data below. This may include their resume, profile, generated career paths, gap analysis results, learning path, board of advisors feedback, Odyssey Plan lives, career comparison, elevator pitch, cover letter, resume review, and interview feedback. Use everything that's provided.
>
> Produce two things:
>
> 1. **Themes** — identify 3-5 recurring themes that appear across the student's data. Each theme should have:
>    - A short, evocative name (2-5 words, e.g., "Making data tell stories" or "Helping people navigate systems")
>    - Evidence: 2-4 bullet points showing where this theme appears in the student's data (cite specific experiences, skills, career choices, or feedback)
>    - A reflection question the student can sit with (e.g., "What would it look like to build a career around this?")
>
> 2. **Narrative** — a 2-4 paragraph first-person story that weaves the themes together. Written as if the student is telling their own story at a career event or in a personal statement. Conversational but professional. Should feel like an insight, not a summary — the student should read it and think "I hadn't connected those dots before."
>
> Respond with JSON in EXACTLY this shape (no prose, no code fences):
>
> ```
> {
>   "themes": [
>     {
>       "name": string,
>       "evidence": string[],
>       "reflectionQuestion": string
>     }
>   ],
>   "narrative": string (paragraphs separated by \n\n)
> }
> ```

The prompt builder assembles a context block from every non-null session output. Each output type gets its own labelled section:

```
<sessionData>

<careers>
Generated career paths: Data analyst, UX researcher, Product manager, ...
</careers>

<gapAnalysis>
Gap analysis for Data analyst:
Summary: ...
Strengths: ...
Key gaps: ...
</gapAnalysis>

<odysseyLives>
Life 1 — Current Path: Data analyst in a health nonprofit
  Headline: ...
  Dashboard: Resources 3, Likability 4, ...
Life 2 — The Pivot: ...
Life 3 — The Wildcard: ...
</odysseyLives>

<boardReview>
Recruiter: ...
HR Partner: ...
Hiring Manager: ...
Mentor: ...
Synthesis: agreed on ..., disagreed on ...
</boardReview>

...etc for each non-null output
</sessionData>
```

The builder only includes sections for outputs that exist in the input. If `gapAnalysis` is null, that section is omitted entirely. The prompt is self-describing: the LLM sees exactly what the student has done and what they haven't.

Temperature ~0.6 — needs voice and personality for the narrative, but structured enough for consistent themes.

### Parser

`parseCareerStory` validates:
- `themes` is array of 1+ items (coerce to at least one — a story with zero themes is useless)
- Each theme has non-empty `name`, `evidence` as string array (coerce missing to `[]`), non-empty `reflectionQuestion`
- `narrative` is a non-empty string
- Strips code fences

---

## Result view

### Layout

```
────── Your career story ──────

[Narrative: 2-4 paragraphs, clean reading typography]

────── Themes we found ──────

┌─ Making data tell stories ──────────────────────┐
│ Evidence:                                         │
│   · Resume: 3 years of data analysis at Curtin    │
│   · Careers: Data analyst ranked highest          │
│   · Odyssey: Current path centred on health data  │
│                                                    │
│ What would it look like to build a career          │
│ around this?                                       │
└───────────────────────────────────────────────────┘

┌─ Helping people navigate systems ─────────────────┐
│ ...                                                │
└───────────────────────────────────────────────────┘

...
```

- Narrative first (the payoff). Rendered as paragraphs split by `\n\n`. Clean reading typography: `text-ink leading-relaxed`, generous max-width.
- Themes below, separated by an editorial-rule divider. Each theme is a card: name as heading, evidence as bullets, reflection question in italics at the bottom.
- Themes are NOT collapsible — there are only 3-5 and the student should see them all.

---

## DOCX export

`components/career-story/career-story-docx.ts`:

```ts
export async function careerStoryToDocx(story: CareerStory): Promise<Blob>;
```

Document structure:
- Title: "My Career Story" (Heading 1)
- Subtitle: "Generated from your Career Compass session"
- Narrative paragraphs (body text, Calibri 12pt)
- Section break
- "Themes" heading (Heading 2)
- For each theme:
  - Theme name (Heading 3)
  - "Evidence:" label (bold)
  - Evidence bullets (list)
  - Reflection question (italic paragraph)

The student downloads this and has a working document they can edit, expand, and make their own.

---

## Markdown export

`careerStoryToMarkdown(story: CareerStory): string` in `lib/markdown-export.ts`:

```markdown
# My Career Story

## The narrative
{paragraph 1}

{paragraph 2}

...

## Themes

### 1. {theme name}
**Evidence:**
- bullet 1
- bullet 2

*{reflection question}*

### 2. {theme name}
...

---

*AI-generated career story. The themes are real patterns from your data. The narrative is a starting point — edit it to match your voice.*
```

---

## Landing page integration

### Reflect pillar — third card

```
─── Reflect ───
[Imagine three lives]
[Board of advisors]
[Career story]          Find the thread connecting your experiences.
```

Icon: `BookOpen` from Lucide.

### SessionBanner

```ts
const hasCareerStory = !!careerStory;
```
```tsx
{hasCareerStory && (
  <Link href='/career-story' className='underline hover:text-accent'>
    career story ready
  </Link>
)}
```

---

## Nudges on result views

Three result views get a quiet text link at the bottom. NOT a chain button — a subtle nudge:

**GapAnalysisView**, **LearningPathView** (after existing chain buttons):
```tsx
<p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
  Ready to see the bigger picture?{' '}
  <Link href='/career-story' className='underline hover:text-accent'>
    Build your career story
  </Link>
</p>
```

**Board page** (`app/board/page.tsx`, in the result view after BoardSynthesisPanel):
Same nudge text.

**Odyssey page** (`app/odyssey/page.tsx`, below the card/compare views):
Same nudge text.

These are NOT on gap analysis input cards or loading states — only on the result views (the student has finished using that feature and might be ready for synthesis).

---

## Error handling

Same patterns as every other feature:
- Pre-flight `isLLMConfigured()`.
- Gate: at least one of resume or freeText.
- Token limits: trim-retry with a custom order — trim session outputs first (comparison, then boardReview, then odysseyLives, then careers, then gapAnalysis, then learningPath), then jobAdvert, then resume. This preserves the resume as long as possible.
- Parse failure → toast + input card preserved.
- Thin session data → the LLM still produces themes and narrative, just thinner. No special error for "not enough data" — the helper note already sets expectations.

---

## Testing

### Unit tests

- `lib/session-store.test.ts` — `setCareerStory`, `reset()` clears, `resetOutputs()` clears
- `lib/prompts/career-story.test.ts`:
  - Prompt includes resume and profile when provided
  - Prompt includes session outputs when provided (careers, gapAnalysis, etc.)
  - Prompt omits session sections that are null
  - Prompt asks for themes + narrative JSON shape
  - `parseCareerStory` happy path: themes array + narrative
  - Strips code fences
  - Throws on missing narrative
  - Throws on zero themes
  - Coerces missing evidence arrays to `[]`
- `lib/markdown-export.test.ts` — `careerStoryToMarkdown` snapshot tests

### Manual QA

- [ ] Reflect pillar shows 3 cards: Imagine three lives, Board of advisors, Career story
- [ ] Click Career story with only a resume → thin story with 2-3 themes
- [ ] Use multiple features first (gap analysis, board, odyssey) then Career story → richer story, more themes, more specific evidence
- [ ] Helper note visible: "This works best when you've explored other features first..."
- [ ] Result: narrative first (clean reading layout), themes below (cards with evidence + reflection questions)
- [ ] Copy as Markdown → includes narrative + all themes + footer
- [ ] Save as DOCX → downloads, opens in Word with title + narrative + themes
- [ ] Generate another → returns to input card
- [ ] SessionBanner shows "career story ready"
- [ ] Nudge links visible on gap analysis, board, and odyssey result views
- [ ] Auto-run: arrive with resume loaded → generates on mount
- [ ] Start over → career story cleared
- [ ] Electron dev build end to end

---

## Scope

### In scope
- `CareerTheme`, `CareerStory` types + field + action in session store
- `lib/prompts/career-story.ts` prompt builder + parser + tests
- `lib/markdown-export.ts` extended with `careerStoryToMarkdown` + tests
- `components/career-story/career-story-docx.ts` DOCX export
- `app/api/careerStory/route.ts` with custom trim-retry order
- `app/career-story/page.tsx` orchestrator
- `components/career-story/CareerStoryInputCard.tsx`
- `components/career-story/CareerStoryResultView.tsx`
- Landing Reflect pillar — add Career story card
- SessionBanner — add career story link
- Nudge links on gap analysis, board, odyssey, learning path result views

### Out of scope
- Interactive theme editing (student accepts the LLM's themes as-is)
- "Build on this theme" follow-up prompts
- Career story as input to other features (it's a terminal output)
- Grounding (personal synthesis, not market research)
- PDF export (DOCX + Markdown covers the need)
- Career card dropdown entry (story is about the whole student, not a specific role)

### Carry-forward
- F16 Export / Report Generation could include the career story as a section in a comprehensive PDF report. The `CareerStory` type is self-contained enough to embed.
