# Endpoint-Owned Inputs

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Context:** Refinement of the actions-first landing. The MissingInputsModal approach had bugs (fields disappearing on input) and a deeper UX problem: split input collection (some in modal, some on endpoint pages). This redesign moves all input collection to the endpoints themselves. Every action page owns its own input lifecycle: check store on mount → auto-run if ready → show input card if not.

---

## Summary

Delete `MissingInputsModal`, `useGatedNavigate`, and `lib/action-gate.ts`. Landing action cards become simple navigators — every click is `router.push(path)`. Each endpoint page has three states:

1. **Has result** → render the result (existing behaviour)
2. **No result, has required inputs** → auto-run the API call with loading state → render result
3. **No result, missing required inputs** → show an input card (target + profile fields, pre-filled from store)

Board, Compare, and Interview already have input views. Gap analysis, Learning path, and Careers need small input cards added. Chain-outs (career card shortcuts, result-view chains) simplify to: set store fields → clear previous result → navigate.

---

## The pattern (per endpoint)

```
page mount → read store →
  result exists? → render result view
  no result, all required inputs present? → auto-run API (loading state) → render result
  no result, inputs missing? → render input card (pre-filled from store)
```

### Requirements per action

| Action | Route | Needs target | Needs profile | Has input view today |
|--------|-------|-------------|---------------|---------------------|
| Find my careers | `/careers` | yes (any input) | no | no (just "No careers yet") |
| Compare careers | `/compare` | yes | no | yes (`CompareInputCard`) |
| Start chatting | `/chat` | no | no | n/a (no requirements) |
| Gap analysis | `/gap-analysis` | yes | yes | no (just "No analysis yet") |
| Learning path | `/learning-path` | yes | no | no (just "No path yet") |
| Practice interview | `/interview` | yes | no | yes (setup card) |
| Imagine three lives | `/odyssey` | no | no | n/a (no requirements) |
| Board of advisors | `/board` | no | yes | yes (`BoardInputCard`) |

### What changes per endpoint

**`/careers`** — currently has auto-run-on-mount when inputs exist. Add an input card for the "no inputs" case instead of "No careers yet. Back to start." The input card shows: resume upload, about you, job title, job advert. Any one field is enough (same as the old ActionsZone gate). Run button: "Find my careers."

**`/gap-analysis`** — currently only renders existing results or a "No analysis" placeholder. Add: (a) an input card when result is null and inputs are missing (shows: job title, job advert, resume, about you), (b) auto-run on mount when result is null but inputs are sufficient. The API call logic that was in `ActionsZone.handleGapAnalysis` moves here.

**`/learning-path`** — same pattern as gap analysis. Input card when missing (shows: job title, job advert, resume, about you — target is required, profile is optional context). Auto-run when ready. The API call logic that was in `ActionsZone.handleLearningPath` moves here.

**`/compare`** — already has `CompareInputCard` for quick mode. Add auto-run bypass: if the student has a `comparePrefill` with `seedTarget` AND a comparison result doesn't exist AND... actually, Compare is more complex because it needs 2-3 targets, not just store fields. The current `CompareInputCard` already handles this well. Just make sure arriving with `comparePrefill.seedTarget` shows the input card pre-filled, and arriving with `richCareerTitles` auto-fires. This already works — no change needed.

**`/board`** — already has `BoardInputCard`. Add auto-run bypass: if `boardReview` is null but profile exists, don't auto-run — the student hasn't provided framing yet (framing is action-specific input, optional but part of the board experience). So Board keeps its current flow: input card → fill framing → convene. No bypass needed — the input card IS the experience.

**`/interview`** — already has setup card (pick difficulty). No change. The setup card IS the interview's input view. No auto-run bypass (student must pick difficulty).

**`/chat`** — no requirements, no change.

**`/odyssey`** — no requirements, no change.

### Auto-run summary

| Endpoint | Auto-run on mount? | Condition |
|----------|--------------------|-----------|
| `/careers` | yes | inputs present, no careers |
| `/gap-analysis` | yes | target + profile present, no gapAnalysis |
| `/learning-path` | yes | target present, no learningPath |
| `/compare` | yes (rich mode only) | richCareerTitles prefill present |
| `/board` | no | always shows input card (framing is part of the experience) |
| `/interview` | no | always shows setup card (difficulty is part of the experience) |

---

## Landing page changes

### `ActionCards.tsx`

Simplify: remove `gatedPush` and `onDirectPush` props. Every card just calls `router.push(path)` with optional `preNavigate` for store setup (like clearing careers or setting compare prefill).

```tsx
type Props = {};  // no props needed — component owns its navigation

// Each card click:
function handleClick(def: CardDef) {
  def.preNavigate?.();
  router.push(def.path);
}
```

No gate check, no modal, no special-casing for chat/odyssey.

### `app/page.tsx`

Simplify: remove `useGatedNavigate`, `MissingInputsModal`, `onDirectPush`. Just render Hero + ActionCards + SessionBanner.

```tsx
export default function Home() {
  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <ActionCards />
        <SessionBanner />
      </section>
    </div>
  );
}
```

### `SessionBanner`

Make it sticky at the bottom of the viewport so it's always visible:

```tsx
<div className='sticky bottom-0 w-full ...'>
```

Actually — the landing page has `overflow-y-auto` on its outer div. Sticky positioning works within the scroll container. The banner should be outside the scroll container, in a fixed-position footer. Or: keep it inside the scroll flow but always visible because the landing content is short enough (hero + 8 cards fit in one viewport on most screens). If the viewport is small (mobile), the banner scrolls with the content, which is fine — it's at the bottom of the natural content flow.

Simpler: keep the banner at the bottom of the content flow (where it is now). On small screens it scrolls. On normal screens it's visible because the content fits. Don't over-engineer sticky positioning.

---

## Chain-out simplification

Currently, chain-outs from CareerNode and result views run API calls inline before navigating. With endpoint-owned inputs, they simplify to: set store fields → navigate. The endpoint handles the rest.

### CareerNode chain-outs

**`handleAnalyseGaps`** (currently runs `/api/gapAnalysis` inline):

Before (complex, 30 lines):
```ts
async function handleAnalyseGaps() {
  setRunning('gaps');
  const llmConfig = await loadLLMConfig();
  const res = await fetch('/api/gapAnalysis', { ... });
  setGapAnalysis(analysis);
  router.push('/gap-analysis');
}
```

After (simple, 4 lines):
```ts
function handleAnalyseGaps() {
  if (!jobTitle) return;
  store.setJobTitle(jobTitle);
  store.setGapAnalysis(null);
  router.push('/gap-analysis');
}
```

The gap-analysis page auto-runs the API on mount.

**`handleLearningPath`** — same simplification.

**`handlePracticeInterview`** — already simple (just sets jobTitle and navigates). No change.

**`handleBoardShortcut`** — already simple. No change.

### GapAnalysisView chain-outs

**`handlePracticeInterview`** — currently `router.push('/interview')`. No change (interview page has setup card).

**`handleChainToLearningPath`** (currently runs `/api/learningPath` inline):

After:
```ts
function handleChainToLearningPath() {
  store.setLearningPath(null);
  router.push('/learning-path');
}
```

### LearningPathView chain-outs

**`handlePracticeInterview`** — currently `router.push('/interview')`. No change.

**`handleChainToGapAnalysis`** (currently runs `/api/gapAnalysis` inline):

After:
```ts
function handleChainToGapAnalysis() {
  store.setGapAnalysis(null);
  router.push('/gap-analysis');
}
```

### Compare page chain-out

**`handleGapForRole`** — currently `store.setJobTitle(label); router.push('/gap-analysis')`. Add clearing:

```ts
function handleGapForRole(label: string) {
  store.setJobTitle(label);
  store.setGapAnalysis(null);
  router.push('/gap-analysis');
}
```

---

## Endpoint input cards

Three new input card components (small, focused):

### `GapAnalysisInputCard`

Shows when the gap-analysis page has no result and inputs are insufficient. Fields:
- Job title (input)
- Job advert (textarea)
- Resume upload (`LocalFileUpload`)
- About you (textarea)

Pre-filled from store. Helper text: "Gap analysis needs a target (job title or job advert) and a profile (resume or about you). One of each is enough." Run button: "Run gap analysis." Disabled until target + profile are present.

On submit: calls `/api/gapAnalysis` (the same API call that was in ActionsZone), writes result to store, page transitions to result view.

### `LearningPathInputCard`

Same pattern. Fields: job title, job advert, resume, about you. Helper: "Learning path needs a target role. Profile is optional but helps." Run button: "Build learning path." Disabled until target is present.

### `CareersInputCard`

Same pattern. Fields: resume, about you, job title, job advert. Helper: "Fill in any field to get started." Run button: "Find my careers." Disabled until any field is non-empty.

### Shared patterns

All three follow the same structure:
1. Read store on mount, pre-fill fields
2. Write to store on change (so inputs persist even if student navigates away)
3. "Run" button checks requirements, fires API, writes result to store
4. Loading state with LoadingDots
5. On success, the parent page sees the result in the store and transitions to the result view

These are similar enough that a shared base component (`EndpointInputCard`) might make sense. But three small components (each ~80 lines) is also fine. YAGNI: don't abstract until you've built all three and see the duplication.

---

## Files to delete

- `components/MissingInputsModal.tsx`
- `lib/use-gated-navigate.ts`
- `lib/action-gate.ts`
- `lib/action-gate.test.ts`

The gate logic (which inputs does each action need?) moves into each endpoint's own mount check. No shared infrastructure needed — each page knows what it needs.

---

## File changes summary

### New files
- `components/gap-analysis/GapAnalysisInputCard.tsx`
- `components/learning-path/LearningPathInputCard.tsx`
- `components/careers/CareersInputCard.tsx`

### Modified files
- `components/landing/ActionCards.tsx` — simplify to plain navigation
- `app/page.tsx` — remove modal/gate imports
- `app/gap-analysis/page.tsx` — add input card + auto-run on mount
- `app/learning-path/page.tsx` — add input card + auto-run on mount
- `app/careers/page.tsx` — replace "No careers yet" with input card
- `components/CareerNode.tsx` — simplify chain-outs (remove inline API calls, remove useGatedNavigate)
- `components/results/GapAnalysisView.tsx` — simplify chain-outs
- `components/results/LearningPathView.tsx` — simplify chain-outs
- `app/compare/page.tsx` — simplify gap chain-out, remove useGatedNavigate

### Deleted files
- `components/MissingInputsModal.tsx`
- `lib/use-gated-navigate.ts`
- `lib/action-gate.ts`
- `lib/action-gate.test.ts`

### Not changed
- `app/board/page.tsx` — already has input card, no auto-run needed
- `app/compare/page.tsx` — CompareInputCard already works, rich-mode auto-run already works
- `app/interview/page.tsx` — setup card already works
- `app/chat/page.tsx` — no requirements
- `app/odyssey/page.tsx` — no requirements
- `components/landing/SessionBanner.tsx` — keep as-is (content-flow positioning, not sticky)
- `lib/session-store.ts` — no changes (resetOutputs already exists)

---

## Testing

### Manual QA

- [ ] Click "Gap analysis" with no inputs → navigate to /gap-analysis → input card shows with helper text
- [ ] Fill job title + resume on the input card → Run → loading → results render
- [ ] Navigate back to landing → session banner shows inputs + "gap analysis ready"
- [ ] Click "Gap analysis" again → auto-runs immediately (inputs still in store, clears old result) → new results
- [ ] Click "Learning path" with no inputs → input card shows
- [ ] Fill job title → Run → results
- [ ] Click "Find my careers" with no inputs → input card shows
- [ ] Fill any one field → Run → careers generate
- [ ] Click "Start chatting" → immediate navigation (no input card)
- [ ] Click "Imagine three lives" → immediate navigation
- [ ] Click "Board of advisors" → input card shows (framing + profile)
- [ ] Click "Compare careers" → input card shows (target slots)
- [ ] Click "Practice interview" → setup card shows (difficulty picker)
- [ ] Career card "Analyse gaps for this role" → /gap-analysis auto-runs (jobTitle was set by the card)
- [ ] Career card "Learning path for this role" → /learning-path auto-runs
- [ ] Gap analysis "Build learning path" chain → /learning-path auto-runs
- [ ] Learning path "Run gap analysis" chain → /gap-analysis auto-runs
- [ ] Compare "Analyse gaps for Data analyst" → /gap-analysis auto-runs or shows input card (if no profile)
- [ ] Remove resume via SessionBanner × → click Gap analysis → input card shows (missing profile)
- [ ] All 8 landing cards navigate correctly
- [ ] No MissingInputsModal appears anywhere
- [ ] Electron dev build end to end

---

## Scope

### In scope
- `GapAnalysisInputCard`, `LearningPathInputCard`, `CareersInputCard`
- Auto-run on mount for gap-analysis, learning-path, careers
- Simplify `ActionCards` to plain navigation
- Simplify `app/page.tsx` (remove modal)
- Simplify CareerNode chain-outs (remove inline API calls)
- Simplify GapAnalysisView/LearningPathView chain-outs
- Simplify compare page gap chain-out
- Delete `MissingInputsModal`, `useGatedNavigate`, `action-gate`

### Out of scope
- Sticky session banner (content-flow positioning is fine)
- Changes to Board, Compare, Interview, Chat, Odyssey endpoint pages
- Changes to SessionBanner
- New tests (pure UI changes — manual QA)
