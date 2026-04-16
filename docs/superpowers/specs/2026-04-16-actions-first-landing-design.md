# Actions-First Landing Redesign

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Context:** QA-driven discovery across F10 and F12. The landing page's InputsZone + ActionsZone + OutputsBanner pattern is form-first when it should be action-first. Students see input boxes before they see what they can do. This redesign flips the hierarchy: actions are the landing page, inputs are collected via the existing MissingInputsModal at point of need, and a merged session banner tracks both loaded inputs and generated outputs.

---

## Summary

Replace the landing page's three-component stack (InputsZone + ActionsZone + OutputsBanner) with a two-component stack (ActionCards + SessionBanner). The page becomes a menu of 8 action cards organised into three pillars (Discover / Assess / Reflect) with a merged session-state banner below. No input fields appear on the landing page. All input collection happens through the existing `MissingInputsModal` when the student clicks an action that needs material they haven't provided yet.

---

## Design principles

- Students see what they can DO, not what they need to FILL IN. Forms are intimidating. Action cards are inviting.
- Each action asks for exactly what it needs, at the moment it needs it, via the modal.
- The session banner provides transparency: what's loaded, what's been generated, with controls to manage both.
- The three pillars (Discover / Assess / Reflect) teach the meta-workflow by layout alone.
- The `MissingInputsModal`, `useGatedNavigate`, and `checkGate` infrastructure already exists and is unchanged.

---

## Page structure

```
┌─────────────────────────────────────────────────────┐
│  Hero: title + tagline                               │
├─────────────────────────────────────────────────────┤
│  Three pillars: Discover | Assess | Reflect          │
│  (action cards stacked per column)                   │
├─────────────────────────────────────────────────────┤
│  Session banner (merged inputs + outputs)             │
│  (only visible when session has any state)            │
└─────────────────────────────────────────────────────┘
```

### Hero

Minimal. Reuses the existing `Hero.tsx` with one copy change to the subtitle:

```
Your Career. Your Direction.
Explore what's possible. Understand what it takes. Reflect on what fits.
```

The new subtitle echoes the three pillars. The existing subtitle (*"AI-powered career exploration that never leaves your device"*) moves to the About page where it fits better.

### Three pillars — `ActionCards.tsx`

Three equal columns on desktop (`md:grid-cols-3`). Each column has a header using `.editorial-rule` and 2-3 action cards stacked below.

**Column order and card order within each:**

```
  ─── Discover ───              ─── Assess ───              ─── Reflect ───
  Find my careers               Gap analysis                Imagine three lives
  Compare careers               Learning path               Board of advisors
  Start chatting                Practice interview           (room for Phase 5)
```

Each column: primary/structured actions at top, open-ended/practice actions at bottom. Chat at the bottom of Discover (the "I don't know where to start" fallback). Practice interview at the bottom of Assess (practice after you've assessed). Reflect column has room for Phase 5 features to land without a layout change.

**Mobile:** Pillars stack vertically. Column headers become section dividers. Cards stack naturally. CSS: the outer grid drops from `md:grid-cols-3` to a single column.

### Card component

Each card is identical structure:

```
┌──────────────────────────┐
│  [Lucide icon]            │
│  Title                    │
│  One-liner description    │
└──────────────────────────┘
```

Styled: `border border-border rounded-lg bg-paper p-5 hover:border-ink-muted transition-colors cursor-pointer`. Icon in `text-accent`, title in `text-ink font-semibold`, description in `text-ink-muted text-sm`.

`title` attribute on each card carries extended hover text (e.g. "Great starting point if you have a resume or know your interests.").

**Card content:**

| Card | Icon | One-liner | Hover |
|------|------|-----------|-------|
| Find my careers | `Compass` | Generate 6 personalised career paths. | Great starting point if you have a resume or know your interests. |
| Compare careers | `Columns3` | Side-by-side across seven dimensions. | Quick compare from job titles, or rich compare from your generated careers. |
| Start chatting | `MessageCircle` | Talk with the career advisor. | Open-ended. Good if you are not sure where to begin. |
| Gap analysis | `SearchCheck` | What you have vs what you need. | Needs a target role and a profile to compare against. |
| Learning path | `Route` | Step-by-step plan to get job-ready. | Needs a target role. Uses your profile for context if available. |
| Practice interview | `Mic` | Simulate a job interview with feedback. | Needs a target role. Uses your profile for richer questions. |
| Imagine three lives | `Sparkles` | Three alternative five-year futures. | From the Designing Your Life framework. Works with or without a profile. |
| Board of advisors | `Users` | Four perspectives on your profile. | Needs a profile. A recruiter, HR partner, manager, and mentor each weigh in. |

### Click behaviour

Every card click goes through `useGatedNavigate`:

```
click → checkGate(action) → canProceed?
  yes → preNavigate() → router.push(path)
  no  → MissingInputsModal opens → student fills → Continue → navigate
```

Chat and Odyssey always pass (no requirements). All others gate as defined in `lib/action-gate.ts`.

**Special cases:**
- **Find my careers:** `preNavigate` clears existing careers (`store.setCareers(null)`) before navigating, same as current.
- **Compare careers:** `preNavigate` writes `store.setComparePrefill({ seedTarget: store.jobAdvert.trim() || store.jobTitle.trim() })` before navigating, same as current.
- **Start chatting:** direct `router.push('/chat')`, no gate, no pre-navigate.
- **Imagine three lives:** direct `router.push('/odyssey')`, no gate, no pre-navigate.

All other actions: gate check → modal if needed → navigate.

---

## Session banner — `SessionBanner.tsx`

Replaces both `InputsZone` and `OutputsBanner` with one merged strip.

### Visibility

Only renders when the session has any state (any input loaded OR any output generated). First-visit student sees no banner — just the hero and the pillars.

### Layout

```
● Loaded: [resume.pdf ×] [About you ×] [Job title: Data analyst ×]  ·  You have: 6 careers · gap analysis · 3 chat messages  [Start over]
```

Single row, `flex-wrap` for narrow screens. Styled identically to the current `OutputsBanner`: `border border-accent/30 bg-accent-soft rounded-lg px-5 py-3`.

### Input pills (left side)

Each loaded input renders as a compact pill: `bg-paper border border-border rounded px-2 py-0.5 text-xs`.

| Store field | Pill label | Clear action |
|-------------|-----------|-------------|
| `resumeText` | `{resumeFilename} ×` | `store.clearResume()` |
| `freeText` (non-empty) | `About you ×` | `store.setFreeText('')` |
| `jobTitle` (non-empty) | `Job title: {value} ×` | `store.setJobTitle('')` |
| `jobAdvert` (non-empty) | `Job advert ×` | `store.setJobAdvert('')` |

The × on each pill: `text-ink-quiet hover:text-ink cursor-pointer ml-1`.

Clearing an input does NOT clear outputs. The student might want to re-run gap analysis with a different resume but keep their existing careers.

### Output links (right side)

Same detection and links as the current `OutputsBanner`:

| Condition | Label | Link |
|-----------|-------|------|
| `careers?.length > 0` | `{N} careers` | `/careers` |
| `chatMessages user count > 0` | `{N} chat messages` | `/chat` |
| `gapAnalysis` | `gap analysis ready` | `/gap-analysis` |
| `learningPath` | `learning path ready` | `/learning-path` |
| `interviewMessages.length > 0 && !interviewFeedback` | `interview in progress` | `/interview` |
| `interviewFeedback` | `interview feedback ready` | `/interview` |
| `odysseyLives any seed or headline` | `odyssey plan in progress` | `/odyssey` |
| `boardReview` | `board review ready` | `/board` |
| `comparison` | `comparison ready` | `/compare` |

Each is a clickable `<Link>` with `underline hover:text-accent`.

### Start over

Far-right button. Calls `store.resetOutputs()` (new action). Confirmation dialog: *"Start over? This clears your results but keeps your uploaded material."*

### `resetOutputs()` store action

New action on `SessionState`. Clears everything EXCEPT:
- `resumeText`, `resumeFilename`
- `freeText`
- `jobTitle`
- `jobAdvert`
- `urlInput`, `urlFetchedTitle`

Clears:
- `chatMessages`, `currentFocus`, `distilledProfile`
- `careers`, `selectedCareerId`
- `gapAnalysis`, `gapAnalysisSources`
- `learningPath`, `learningPathSources`
- `interviewMessages`, `interviewTarget`, `interviewDifficulty`, `interviewPhase`, `interviewTurnInPhase`, `interviewFeedback`, `interviewSources`
- `chatSources`
- `odysseyLives` (reset to three empty slots)
- `boardReview`, `boardPrefill`
- `comparison`, `comparePrefill`, `comparing`

Implementation: builds a partial object from `initialState` for all output fields, preserving input fields from current state.

---

## Landing page assembly

`app/page.tsx` becomes:

```tsx
'use client';

import Hero from '@/components/Hero';
import ActionCards from '@/components/landing/ActionCards';
import SessionBanner from '@/components/landing/SessionBanner';
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';

export default function Home() {
  const { gatedPush, modalProps } = useGatedNavigate();

  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <ActionCards gatedPush={gatedPush} />
        <SessionBanner />
      </section>
      <MissingInputsModal {...modalProps} />
    </div>
  );
}
```

Clean: Hero, cards, banner, modal. No state management for missing hints (the modal handles that internally).

---

## File changes

### New files
- `components/landing/ActionCards.tsx` — three-pillar grid with 8 action cards
- `components/landing/SessionBanner.tsx` — merged inputs + outputs strip

### Modified files
- `app/page.tsx` — swap assembly (InputsZone + ActionsZone + OutputsBanner → ActionCards + SessionBanner + MissingInputsModal)
- `components/Hero.tsx` — update subtitle copy
- `lib/session-store.ts` — add `resetOutputs()` action
- `lib/session-store.test.ts` — test `resetOutputs()` preserves inputs, clears outputs

### Deleted files
- `components/landing/InputsZone.tsx`
- `components/landing/ActionsZone.tsx`
- `components/landing/OutputsBanner.tsx`
- `components/landing/ActionWillUse.tsx`

### Not changed
- `MissingInputsModal.tsx` — used as-is
- `lib/use-gated-navigate.ts` — used as-is
- `lib/action-gate.ts` — used as-is
- All feature endpoints — unchanged
- `CareerNode.tsx` chain-outs — already wired to `useGatedNavigate`

---

## Testing

### Unit tests

- `lib/session-store.test.ts` — `resetOutputs()`:
  - Preserves `resumeText`, `resumeFilename`, `freeText`, `jobTitle`, `jobAdvert`, `urlInput`, `urlFetchedTitle`
  - Clears `careers`, `chatMessages`, `gapAnalysis`, `learningPath`, `interviewMessages`, `interviewFeedback`, `boardReview`, `comparison`, `odysseyLives`, `distilledProfile`, `comparing`, `boardPrefill`, `comparePrefill`, and all source arrays

### Manual QA

- [ ] First visit: no banner, hero + three pillars only
- [ ] Three columns on desktop: Discover (3 cards) | Assess (3 cards) | Reflect (2 cards)
- [ ] Mobile: pillars stack vertically with section headers
- [ ] Hover on each card shows extended description tooltip
- [ ] Click "Start chatting" → navigates immediately to `/chat`
- [ ] Click "Imagine three lives" → navigates immediately to `/odyssey`
- [ ] Click "Gap analysis" with no inputs → modal opens showing target + profile fields
- [ ] Fill resume in modal → Continue activates → click → navigates to `/gap-analysis`
- [ ] Return to landing → session banner shows "Loaded: resume.pdf ×" and "gap analysis ready"
- [ ] Click × on resume → pill disappears, resume cleared
- [ ] Click "Board of advisors" → modal opens (resume was just cleared, needs profile)
- [ ] Fill about-you in modal → Continue → navigates to `/board`
- [ ] Return to landing → banner shows "Loaded: About you ×" and "board review ready"
- [ ] Click "Find my careers" with no inputs → modal opens → fill job title → Continue → navigates to `/careers`
- [ ] Click "Compare careers" with no inputs → modal opens → fill job title → Continue → navigates to `/compare` with target pre-filled
- [ ] Start over → confirmation → outputs cleared (careers, gap analysis, etc. gone from banner), input pills remain
- [ ] After start over, click "Gap analysis" → resume still loaded, modal only asks for target
- [ ] All 8 action cards navigate to correct endpoints
- [ ] All feature endpoints still work correctly (chat, careers, gap analysis, learning path, interview, odyssey, board, compare)
- [ ] Chain-outs from feature endpoints (career card shortcuts, result-view chains) still work via `useGatedNavigate`
- [ ] Electron dev build end to end

---

## Scope and non-goals

### In scope
- `ActionCards.tsx` three-pillar grid
- `SessionBanner.tsx` merged inputs + outputs strip with × clear buttons
- `resetOutputs()` store action + test
- Landing page assembly swap in `app/page.tsx`
- Hero subtitle update
- Delete InputsZone, ActionsZone, OutputsBanner, ActionWillUse

### Out of scope
- Styled tooltip component (ship with `title` attribute)
- Paste-to-fetch URL detection in MissingInputsModal (existing deferral)
- Changes to any feature endpoint
- Changes to MissingInputsModal or useGatedNavigate or action-gate
- Phase 5 features (materials + export)
