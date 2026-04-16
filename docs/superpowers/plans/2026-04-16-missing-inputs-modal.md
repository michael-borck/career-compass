# Missing Inputs Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a shared `MissingInputsModal` + `useGatedNavigate` hook so that chain-out buttons (career card shortcuts, result-view chains, compare gap buttons) show an inline input modal when the destination action's required inputs are missing, instead of silently navigating to a dead-end page.

**Architecture:** Pure `checkGate(action)` function reads the session store and returns `{canProceed, missingTarget, missingProfile}`. A `useGatedNavigate` hook wraps `router.push` with the gate check and manages modal open/close state. `MissingInputsModal` uses the existing shadcn `Dialog` + `LocalFileUpload` + landing textarea patterns. Five chain-out sites are retrofitted.

**Tech Stack:** Next.js 14 App Router, Zustand, Vitest, shadcn Dialog, existing `LocalFileUpload`.

**Spec:** `docs/superpowers/specs/2026-04-16-missing-inputs-modal-design.md`

---

## File Structure

**New files:**
- `lib/action-gate.ts` — `getActionRequirements`, `checkGate` pure functions
- `lib/action-gate.test.ts`
- `components/MissingInputsModal.tsx` — shared modal
- `lib/use-gated-navigate.ts` — hook wrapping router.push with gate + modal state

**Modified files:**
- `components/CareerNode.tsx` — retrofit `handlePracticeInterview` and `handleBoardShortcut`
- `components/results/GapAnalysisView.tsx` — retrofit `handlePracticeInterview`
- `components/results/LearningPathView.tsx` — retrofit `handlePracticeInterview`
- `app/compare/page.tsx` — retrofit `handleGapForRole`

---

## Task 1: `lib/action-gate.ts` — gate check pure functions

**Files:**
- Create: `lib/action-gate.ts`
- Create: `lib/action-gate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/action-gate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';
import { getActionRequirements, checkGate, type GatedAction } from './action-gate';

describe('getActionRequirements', () => {
  it('gaps needs target and profile', () => {
    expect(getActionRequirements('gaps')).toEqual({ needsTarget: true, needsProfile: true });
  });

  it('interview needs target only', () => {
    expect(getActionRequirements('interview')).toEqual({ needsTarget: true, needsProfile: false });
  });

  it('learn needs target only', () => {
    expect(getActionRequirements('learn')).toEqual({ needsTarget: true, needsProfile: false });
  });

  it('board needs profile only', () => {
    expect(getActionRequirements('board')).toEqual({ needsTarget: false, needsProfile: true });
  });

  it('compare needs target only', () => {
    expect(getActionRequirements('compare')).toEqual({ needsTarget: true, needsProfile: false });
  });

  it('careers needs target only', () => {
    expect(getActionRequirements('careers')).toEqual({ needsTarget: true, needsProfile: false });
  });
});

describe('checkGate', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('gaps with nothing returns all missing', () => {
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(false);
    expect(result.missingTarget).toBe(true);
    expect(result.missingProfile).toBe(true);
  });

  it('gaps with jobTitle + resume can proceed', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    useSessionStore.getState().setResume('Resume text', 'resume.pdf');
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(true);
    expect(result.missingTarget).toBe(false);
    expect(result.missingProfile).toBe(false);
  });

  it('gaps with jobAdvert + freeText can proceed', () => {
    useSessionStore.getState().setJobAdvert('We are hiring...');
    useSessionStore.getState().setFreeText('I am a student...');
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(true);
  });

  it('gaps with distilledProfile as profile source can proceed', () => {
    useSessionStore.getState().setJobTitle('Analyst');
    useSessionStore.getState().setDistilledProfile({
      background: 'bg', interests: [], skills: [], constraints: [], goals: [],
    });
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(true);
    expect(result.missingProfile).toBe(false);
  });

  it('gaps with only jobTitle (no profile) cannot proceed', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(false);
    expect(result.missingTarget).toBe(false);
    expect(result.missingProfile).toBe(true);
  });

  it('interview with jobTitle can proceed', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    expect(checkGate('interview').canProceed).toBe(true);
  });

  it('interview with nothing cannot proceed', () => {
    expect(checkGate('interview').canProceed).toBe(false);
    expect(checkGate('interview').missingTarget).toBe(true);
  });

  it('board with resume can proceed', () => {
    useSessionStore.getState().setResume('text', 'r.pdf');
    expect(checkGate('board').canProceed).toBe(true);
  });

  it('board with nothing cannot proceed', () => {
    expect(checkGate('board').canProceed).toBe(false);
    expect(checkGate('board').missingProfile).toBe(true);
  });

  it('board ignores target requirement', () => {
    useSessionStore.getState().setResume('text', 'r.pdf');
    const result = checkGate('board');
    expect(result.missingTarget).toBe(false);
  });

  it('compare with jobAdvert can proceed', () => {
    useSessionStore.getState().setJobAdvert('Hiring...');
    expect(checkGate('compare').canProceed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/action-gate.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/action-gate.ts`**

```ts
import { useSessionStore } from './session-store';

export type GatedAction = 'careers' | 'gaps' | 'learn' | 'interview' | 'board' | 'compare';

export type ActionRequirements = {
  needsTarget: boolean;
  needsProfile: boolean;
};

export type GateResult = {
  canProceed: boolean;
  missingTarget: boolean;
  missingProfile: boolean;
};

const REQUIREMENTS: Record<GatedAction, ActionRequirements> = {
  careers: { needsTarget: true, needsProfile: false },
  gaps: { needsTarget: true, needsProfile: true },
  learn: { needsTarget: true, needsProfile: false },
  interview: { needsTarget: true, needsProfile: false },
  board: { needsTarget: false, needsProfile: true },
  compare: { needsTarget: true, needsProfile: false },
};

export function getActionRequirements(action: GatedAction): ActionRequirements {
  return REQUIREMENTS[action];
}

export function checkGate(action: GatedAction): GateResult {
  const reqs = REQUIREMENTS[action];
  const state = useSessionStore.getState();

  const hasTarget =
    !!(state.jobTitle && state.jobTitle.trim()) ||
    !!(state.jobAdvert && state.jobAdvert.trim());

  const hasProfile =
    !!state.resumeText ||
    !!(state.freeText && state.freeText.trim()) ||
    !!state.distilledProfile;

  const missingTarget = reqs.needsTarget && !hasTarget;
  const missingProfile = reqs.needsProfile && !hasProfile;

  return {
    canProceed: !missingTarget && !missingProfile,
    missingTarget,
    missingProfile,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/action-gate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/action-gate.ts lib/action-gate.test.ts
git commit -m "feat(gate): add checkGate and getActionRequirements for chain-out gating"
```

---

## Task 2: `components/MissingInputsModal.tsx` — shared modal

**Files:**
- Create: `components/MissingInputsModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import { useSessionStore } from '@/lib/session-store';
import { checkGate, type GatedAction } from '@/lib/action-gate';

type Props = {
  action: GatedAction;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
};

const ACTION_LABELS: Record<GatedAction, string> = {
  careers: 'Find my careers needs some material to work with.',
  gaps: 'Gap analysis needs a target role and a profile to compare against.',
  learn: 'Learning path needs a target role to build toward.',
  interview: 'Practice interview needs a target role to prepare for.',
  board: 'Board of advisors needs a profile to review.',
  compare: 'Compare needs a target role to start with.',
};

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function MissingInputsModal({ action, open, onClose, onContinue }: Props) {
  const store = useSessionStore();
  const gate = checkGate(action);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();

  const showResume = gate.missingProfile && !hasResume;
  const showAboutYou = gate.missingProfile && !hasFreeText;
  const showJobTitle = gate.missingTarget && !hasJobTitle;
  const showJobAdvert = gate.missingTarget && !hasJobAdvert;

  const handleResumeSelect = useCallback(
    async (file: File) => {
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
      } catch (err) {
        console.error(err);
        toast.error('Could not read that file. Try a different format.');
      }
    },
    [store]
  );

  const canContinue = checkGate(action).canProceed;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Before we continue...</DialogTitle>
        </DialogHeader>
        <p className='text-ink-muted text-[var(--text-sm)] mb-4'>{ACTION_LABELS[action]}</p>

        <div className='space-y-4'>
          {showResume && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Resume
              </label>
              <LocalFileUpload
                onFileSelect={handleResumeSelect}
                className='w-full flex items-center justify-center'
              />
              {store.resumeFilename && (
                <p className='text-[var(--text-xs)] text-ink-muted mt-1'>
                  Selected: {store.resumeFilename}
                </p>
              )}
            </div>
          )}

          {showAboutYou && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                About you
              </label>
              <Textarea
                value={store.freeText}
                rows={3}
                onChange={(e) => store.setFreeText(e.target.value)}
                placeholder='A sentence or two about your background, interests, or goals.'
              />
            </div>
          )}

          {showJobTitle && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Job title
              </label>
              <Input
                value={store.jobTitle}
                onChange={(e) => store.setJobTitle(e.target.value)}
                placeholder='e.g. Data analyst, UX researcher'
              />
            </div>
          )}

          {showJobAdvert && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Job advert
              </label>
              <Textarea
                value={store.jobAdvert}
                rows={3}
                onChange={(e) => store.setJobAdvert(e.target.value)}
                placeholder='Paste a short job listing or description.'
              />
            </div>
          )}
        </div>

        <div className='flex justify-end gap-3 mt-6'>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onContinue} disabled={!canContinue}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MissingInputsModal.tsx
git commit -m "feat(gate): add MissingInputsModal with inline resume/about/title/advert fields"
```

---

## Task 3: `lib/use-gated-navigate.ts` — hook

**Files:**
- Create: `lib/use-gated-navigate.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { checkGate, type GatedAction } from './action-gate';

type ModalState = {
  action: GatedAction;
  path: string;
  preNavigate?: () => void;
} | null;

export function useGatedNavigate() {
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState>(null);

  const gatedPush = useCallback(
    (action: GatedAction, path: string, preNavigate?: () => void) => {
      const gate = checkGate(action);
      if (gate.canProceed) {
        preNavigate?.();
        router.push(path);
        return;
      }
      setModalState({ action, path, preNavigate });
    },
    [router]
  );

  const handleContinue = useCallback(() => {
    if (!modalState) return;
    modalState.preNavigate?.();
    router.push(modalState.path);
    setModalState(null);
  }, [modalState, router]);

  const handleClose = useCallback(() => {
    setModalState(null);
  }, []);

  const modalProps = {
    action: (modalState?.action ?? 'gaps') as GatedAction,
    open: modalState !== null,
    onClose: handleClose,
    onContinue: handleContinue,
  };

  return { gatedPush, modalProps };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/use-gated-navigate.ts
git commit -m "feat(gate): add useGatedNavigate hook for chain-out gating"
```

---

## Task 4: Retrofit `CareerNode.tsx` — interview + board chain-outs

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Read the file, then add imports**

Add these imports at the top:

```ts
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';
```

- [ ] **Step 2: Wire the hook**

Inside the `CareerNode` function, near the top (after the existing `useState` for `running`):

```ts
  const { gatedPush, modalProps } = useGatedNavigate();
```

- [ ] **Step 3: Replace `handlePracticeInterview`**

Replace:

```ts
  function handlePracticeInterview() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    router.push('/interview');
  }
```

With:

```ts
  function handlePracticeInterview() {
    if (!jobTitle) return;
    gatedPush('interview', '/interview', () => setStoreJobTitle(jobTitle));
  }
```

- [ ] **Step 4: Replace `handleBoardShortcut`**

Replace:

```ts
  function handleBoardShortcut() {
    useSessionStore.getState().setBoardPrefill({ focusRole: jobTitle });
    router.push('/board');
  }
```

With:

```ts
  function handleBoardShortcut() {
    gatedPush('board', '/board', () => {
      useSessionStore.getState().setBoardPrefill({ focusRole: jobTitle });
    });
  }
```

- [ ] **Step 5: Render the modal**

At the very end of the JSX, just before the closing `</Dialog>` tag (inside the Dialog, so it's part of the component's render tree), add:

```tsx
      <MissingInputsModal {...modalProps} />
```

Wait — `MissingInputsModal` uses its own `Dialog` from shadcn, and `CareerNode` is already inside a `Dialog`. Nesting Radix dialogs can conflict. Instead, render `MissingInputsModal` **outside** the existing `<Dialog>`, at the top level of the returned JSX. Wrap both in a fragment:

Change the return from:

```tsx
  return (
    <Dialog>
      ...
    </Dialog>
  );
```

To:

```tsx
  return (
    <>
      <Dialog>
        ...
      </Dialog>
      <MissingInputsModal {...modalProps} />
    </>
  );
```

- [ ] **Step 6: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/CareerNode.tsx
git commit -m "fix(careers): gate interview and board chain-outs with MissingInputsModal"
```

---

## Task 5: Retrofit `GapAnalysisView.tsx` — interview chain-out

**Files:**
- Modify: `components/results/GapAnalysisView.tsx`

- [ ] **Step 1: Read the file, then add imports**

Add these imports:

```ts
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';
```

- [ ] **Step 2: Wire the hook**

Inside the `GapAnalysisView` function body, near the other `useState` calls:

```ts
  const { gatedPush, modalProps } = useGatedNavigate();
```

- [ ] **Step 3: Replace `handlePracticeInterview`**

Replace:

```ts
  function handlePracticeInterview() {
    router.push('/interview');
  }
```

With:

```ts
  function handlePracticeInterview() {
    gatedPush('interview', '/interview');
  }
```

No `preNavigate` needed — the gap analysis view already has the jobTitle in the store (gap analysis ran with a target).

- [ ] **Step 4: Render the modal**

Append at the end of the returned JSX, as a sibling inside the top-level `<div>`:

```tsx
      <MissingInputsModal {...modalProps} />
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/results/GapAnalysisView.tsx
git commit -m "fix(gap-analysis): gate interview chain-out with MissingInputsModal"
```

---

## Task 6: Retrofit `LearningPathView.tsx` — interview chain-out

**Files:**
- Modify: `components/results/LearningPathView.tsx`

- [ ] **Step 1: Read the file, then add imports**

Add these imports:

```ts
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';
```

- [ ] **Step 2: Wire the hook**

Inside the `LearningPathView` function body, near the other `useState` calls:

```ts
  const { gatedPush, modalProps } = useGatedNavigate();
```

- [ ] **Step 3: Replace `handlePracticeInterview`**

Replace:

```ts
  function handlePracticeInterview() {
    router.push('/interview');
  }
```

With:

```ts
  function handlePracticeInterview() {
    gatedPush('interview', '/interview');
  }
```

- [ ] **Step 4: Render the modal**

Append at the end of the returned JSX:

```tsx
      <MissingInputsModal {...modalProps} />
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/results/LearningPathView.tsx
git commit -m "fix(learning-path): gate interview chain-out with MissingInputsModal"
```

---

## Task 7: Retrofit `app/compare/page.tsx` — gap analysis chain-out

**Files:**
- Modify: `app/compare/page.tsx`

- [ ] **Step 1: Read the file, then add imports**

Add these imports:

```ts
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';
```

- [ ] **Step 2: Wire the hook**

Inside the `ComparePage` function body, near the existing `useState` calls:

```ts
  const { gatedPush, modalProps } = useGatedNavigate();
```

- [ ] **Step 3: Replace `handleGapForRole`**

Replace:

```ts
  function handleGapForRole(label: string) {
    store.setJobTitle(label);
    router.push('/gap-analysis');
  }
```

With:

```ts
  function handleGapForRole(label: string) {
    gatedPush('gaps', '/gap-analysis', () => store.setJobTitle(label));
  }
```

This gates on both target (which `preNavigate` sets) and profile. If the student has no profile, the modal opens and they can add one. When they click Continue, the `preNavigate` fires (setting jobTitle) and then navigation happens.

Wait — `checkGate` reads the store at the time `gatedPush` is called. The `preNavigate` hasn't run yet, so `jobTitle` won't be set when `checkGate` runs, meaning `missingTarget` will be true even though the label is about to be set. Fix: set the jobTitle *before* calling gatedPush:

```ts
  function handleGapForRole(label: string) {
    store.setJobTitle(label);
    gatedPush('gaps', '/gap-analysis');
  }
```

This is correct because `setJobTitle` is a synchronous Zustand `set()` call — it updates the store immediately. When `gatedPush` calls `checkGate('gaps')` on the next line, the store already has the jobTitle. If profile is missing, the modal opens. The jobTitle is already in the store, so the modal only shows profile fields. When the student fills profile and clicks Continue, navigation fires.

- [ ] **Step 4: Render the modal**

Append at the end of the returned JSX, just before the closing `</div>` of the outermost container (but inside the Toaster sibling scope). Or place it right before `<Toaster />`:

```tsx
      <MissingInputsModal {...modalProps} />
      <Toaster />
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add app/compare/page.tsx
git commit -m "fix(compare): gate gap analysis chain-out with MissingInputsModal"
```

---

## Task 8: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS — all prior tests plus new action-gate tests.

- [ ] **Step 2: Start the app**

Run: `npm run electron:dev`

- [ ] **Step 3: Walk the QA checklist**

From the spec, verify:

- From `/compare` result, click "Analyse gaps for Data analyst" with no profile → modal appears showing resume upload + about-you textarea, NOT job title (because target is already set)
- Upload a resume inside the modal → Continue activates → click → navigates to `/gap-analysis` and runs
- Cancel instead → modal closes, stay on `/compare`
- From career card dialog, click "Practice interview for this role" → should work immediately (career cards have a jobTitle, and interview only needs target)
- From career card dialog, click "Ask the board about this role" with no profile → modal appears showing resume + about-you
- Fill about-you in the modal → Continue → navigates to `/board` with focus role pre-filled
- From gap analysis view, click "Practice interview" → if jobTitle exists in store, proceeds directly; if somehow missing, modal appears
- From learning path view, click "Practice interview" → same behaviour
- Modal only shows fields that are actually missing (not ones already filled)
- Modal's Continue button re-checks live as the student types (e.g., type a job title → Continue activates immediately)
- All existing landing-page gating still works (ActionsZone unchanged)
- All existing 8 landing action buttons still work
- Electron dev build end to end

- [ ] **Step 4: Fix any QA findings**

If any behaviour is wrong, commit fixes separately.

---

## Notes for the implementer

- **Nested Dialog issue.** `CareerNode` already renders inside a shadcn `<Dialog>`. The `MissingInputsModal` is a second `<Dialog>`. Radix UI supports nested dialogs, but the modal MUST be rendered as a sibling of the existing Dialog (`<>...<Dialog>...</Dialog><MissingInputsModal /></>`), NOT nested inside it. Otherwise the overlay stacking breaks.
- **`checkGate` reads the store synchronously.** Zustand's `getState()` is sync. `gatedPush` can safely call `checkGate` in the same tick after a `store.setJobTitle()` call — the store has already updated.
- **The `preNavigate` callback fires only on direct proceed OR after modal Continue.** It's not called when the modal opens. This means state-setting callbacks (like `setJobTitle`) that should happen before gate-check need to happen *before* `gatedPush`, not inside `preNavigate`. Compare's `handleGapForRole` demonstrates this: `store.setJobTitle(label)` first, then `gatedPush('gaps', '/gap-analysis')`.
- **The modal writes directly to the session store.** Resume upload calls `store.setResume`, about-you calls `store.setFreeText`, etc. These are the same store fields the landing page uses. When the student fills them in the modal, the data persists for the rest of the session — if they go back to landing later, they'll see the fields populated.
- **Paste-to-fetch URL detection in the modal's job advert field is out of scope.** The modal uses a plain `<Textarea>` for job advert. URL detection can be added later.
- **Don't change `ActionsZone.tsx`.** Landing gating is separate from chain-out gating. The modal is only for chain-outs.
