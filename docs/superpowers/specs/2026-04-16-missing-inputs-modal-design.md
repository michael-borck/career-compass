# Missing Inputs Modal — Chain-Out Gate

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Context:** Discovered during F10 QA. Chain-out buttons (career card shortcuts, result-view chains, compare gap-analysis buttons) can navigate students to action endpoints that lack required inputs. The landing page gates these properly, but chain-outs bypass the landing.

---

## Summary

A shared `MissingInputsModal` component that any chain-out can invoke before navigating. When the student clicks a chain button and the destination's required inputs aren't satisfied, the modal pops up showing what's missing, with inline input fields so the student can provide the material right there. Continue navigates; Cancel closes the modal. No greyed-out buttons, no silent failures, no "go back to landing."

---

## Architecture

### Shared hook: `useActionGate`

```ts
export type GatedAction = 'careers' | 'gaps' | 'learn' | 'interview' | 'board' | 'compare';

export type ActionRequirements = {
  needsTarget: boolean;    // jobTitle OR jobAdvert
  needsProfile: boolean;   // resumeText OR freeText OR distilledProfile
};

export type GateResult = {
  canProceed: boolean;
  missingTarget: boolean;
  missingProfile: boolean;
};

export function getActionRequirements(action: GatedAction): ActionRequirements;
export function checkGate(action: GatedAction): GateResult;
```

Requirements map (single source of truth, shared with `ActionWillUse` if desired):

| Action | Needs target | Needs profile |
|--------|-------------|---------------|
| careers | yes (any one input) | no |
| gaps | yes | yes |
| learn | yes | no |
| interview | yes | no |
| board | no | yes |
| compare | yes | no |

Note: `careers` is special — it needs "any input at all" rather than specifically a target. For simplicity, treat it as `needsTarget: true` since job title / job advert satisfy the requirement, and resume/freeText also count. The modal can handle this by showing all input options when the action is `careers`.

Actually, `careers` just needs *any* material — resume OR freeText OR jobTitle OR jobAdvert. Simplify: `careers` has `needsTarget: false, needsProfile: false` but a custom `needsAnyInput: true` flag. Or just special-case it. Given that `careers` chain-outs are rare (only from chat), keep it simple: treat it the same as the landing gate (`hasInput` check).

For the seven at-risk chain-outs identified in the audit, the actions involved are: `gaps`, `interview`, `board`, and `compare`. The requirements are:
- `gaps` → target + profile
- `interview` → target
- `board` → profile
- `compare` → target (but the /careers banner entry already has targets from `comparing`, so runtime check is redundant there — still good to have)

### Shared component: `MissingInputsModal`

```ts
type Props = {
  action: GatedAction;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
};
```

When `open` is true, renders a dialog (reusing the existing `components/ui/dialog.tsx` from shadcn) with:

1. **Header:** "Before we continue..." (or similar neutral copy)
2. **What's missing:** One or two lines explaining what the action needs. Example: *"Gap analysis needs a target (job title or job advert) and a profile (resume or about you) to run."*
3. **Inline inputs for missing fields only:**
   - **Resume upload** — shown when `missingProfile && !resumeText`. Uses the existing `LocalFileUpload` component (already handles PDF/DOCX/MD, writes to `store.setResume`).
   - **About you textarea** — shown when `missingProfile && !freeText.trim()`. Writes to `store.setFreeText` on change.
   - **Job title input** — shown when `missingTarget && !jobTitle.trim()`. Writes to `store.setJobTitle` on change.
   - **Job advert textarea** — shown when `missingTarget && !jobAdvert.trim()`. Writes to `store.setJobAdvert` on change. Supports paste-to-fetch URL detection (same as landing).
4. **Filled fields are hidden.** If the student already has a resume, the resume upload doesn't appear. If they already have a job title, the job title input doesn't appear. Only missing fields show.
5. **Continue button** — activates when the gate check passes (`checkGate(action).canProceed`). The button re-checks on every store change (the inputs write to the store, so the check is live).
6. **Cancel button** — closes the modal. Student stays where they were.

The modal does NOT navigate on Continue — it calls `onContinue()`, which the caller wires to `router.push(...)`. This keeps the modal generic.

### File structure

| Path | Responsibility |
|---|---|
| `lib/action-gate.ts` | `getActionRequirements`, `checkGate` — pure functions reading from session store |
| `lib/action-gate.test.ts` | Unit tests |
| `components/MissingInputsModal.tsx` | The shared modal component |

### Modified files

- `components/CareerNode.tsx` — wrap `handlePracticeInterview` and `handleBoardShortcut` with gate check + modal
- `components/results/GapAnalysisView.tsx` — wrap interview chain with gate check + modal
- `components/results/LearningPathView.tsx` — wrap interview chain with gate check + modal
- `app/compare/page.tsx` — wrap gap analysis chain buttons with gate check + modal

### NOT modified

- `app/careers/page.tsx` — the Compare banner's "Compare N" button relies on `comparing.length >= 2` and the rich-mode prefill, which already contains valid career titles. No missing-inputs scenario.
- `app/chat/page.tsx` — chat chain-outs (handleOdyssey, handleBoard, handleAcceptProfile) all go through API calls that validate inputs before navigating. Already well-gated.
- `components/landing/ActionsZone.tsx` — landing gating is unchanged. The modal is for chain-outs, not for landing.

---

## UI copy

**Modal title:** "Before we continue..."

**Explanation lines per action:**
- `gaps`: "Gap analysis needs a target role and a profile to compare against."
- `interview`: "Practice interview needs a target role to prepare for."
- `board`: "Board of advisors needs a profile to review."
- `compare`: "Compare needs a target role to start with."

**Below the inline inputs:** "Once you have the required material, hit Continue."

**Buttons:** "Continue" (primary, disabled until gate passes) · "Cancel" (outline)

---

## Integration pattern

Each chain-out site follows the same pattern. Before:

```tsx
function handleChain() {
  router.push('/gap-analysis');
}
```

After:

```tsx
const [gateOpen, setGateOpen] = useState(false);
const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

function handleChain() {
  const gate = checkGate('gaps');
  if (gate.canProceed) {
    router.push('/gap-analysis');
    return;
  }
  setPendingAction(() => () => router.push('/gap-analysis'));
  setGateOpen(true);
}

// In JSX:
<MissingInputsModal
  action='gaps'
  open={gateOpen}
  onClose={() => { setGateOpen(false); setPendingAction(null); }}
  onContinue={() => { setGateOpen(false); pendingAction?.(); }}
/>
```

This is boilerplate-heavy if done inline everywhere. To reduce it, provide a **`useGatedNavigate` hook**:

```ts
export function useGatedNavigate() {
  const router = useRouter();
  const [modalState, setModalState] = useState<{
    action: GatedAction;
    path: string;
    preNavigate?: () => void;
  } | null>(null);

  function gatedPush(action: GatedAction, path: string, preNavigate?: () => void) {
    const gate = checkGate(action);
    if (gate.canProceed) {
      preNavigate?.();
      router.push(path);
      return;
    }
    setModalState({ action, path, preNavigate });
  }

  function handleContinue() {
    if (!modalState) return;
    modalState.preNavigate?.();
    router.push(modalState.path);
    setModalState(null);
  }

  function handleClose() {
    setModalState(null);
  }

  const modalProps = modalState
    ? { action: modalState.action, open: true, onClose: handleClose, onContinue: handleContinue }
    : { action: 'gaps' as GatedAction, open: false, onClose: () => {}, onContinue: () => {} };

  return { gatedPush, modalProps };
}
```

Usage at each chain-out site:

```tsx
const { gatedPush, modalProps } = useGatedNavigate();

function handleGapForRole(label: string) {
  gatedPush('gaps', '/gap-analysis', () => store.setJobTitle(label));
}

// Render once per component:
<MissingInputsModal {...modalProps} />
```

This collapses the per-chain boilerplate to one hook call + one modal render per component that has chain-outs.

---

## Paste-to-fetch in the modal

The job advert textarea in the modal should support the same paste-to-fetch URL detection as the landing page. The existing `looksLikeUrl` helper and the fetch-confirm pattern from `InputsZone` can be reused. If the student pastes a URL into the job advert field inside the modal, the same "Fetch page / Keep as text" banner appears inline within the modal's textarea wrapper.

If this is too complex for the first pass, skip it — students can paste raw text. Add URL detection in a follow-up.

---

## Testing

### Unit tests

- `lib/action-gate.test.ts`:
  - `getActionRequirements` returns correct flags for each action
  - `checkGate('gaps')` with no inputs → `{ canProceed: false, missingTarget: true, missingProfile: true }`
  - `checkGate('gaps')` with jobTitle + resume → `{ canProceed: true, missingTarget: false, missingProfile: false }`
  - `checkGate('interview')` with no jobTitle/jobAdvert → `{ canProceed: false, missingTarget: true, missingProfile: false }`
  - `checkGate('board')` with resume → `{ canProceed: true, ... }`
  - etc. for each action

### Manual QA

- From `/compare` result, click "Analyse gaps for Data analyst" with no profile → modal appears showing resume upload + about-you textarea
- Upload a resume inside the modal → Continue activates → click → navigates to `/gap-analysis` and the analysis runs
- Cancel instead → modal closes, stay on `/compare`
- From career card, click "Practice interview" with no jobTitle somehow (edge case — should be impossible since career cards have titles, but the guard should still work)
- From career card, click "Ask the board about this role" with no profile → modal appears
- From gap analysis view, click "Practice interview" chain → should work if jobTitle exists; modal appears if not
- From learning path view, click "Practice interview" chain → same

---

## Scope

### In scope
- `lib/action-gate.ts` + tests
- `components/MissingInputsModal.tsx` with inline resume upload + about-you + job-title + job-advert fields
- `useGatedNavigate` hook
- Retrofit 5 at-risk chain-out sites: CareerNode (interview + board), GapAnalysisView (interview), LearningPathView (interview), compare/page (gap analysis)

### Out of scope
- Paste-to-fetch URL detection in the modal's job advert field (follow-up if needed)
- Refactoring `ActionWillUse` to share the requirements map with `action-gate.ts` (nice-to-have, not blocking)
- Changing the landing `ActionsZone` gating (it works fine as-is)
- Any new action endpoints or routes

### Note on `careers` chain-out from chat
The `handleAcceptProfile` in `app/chat/page.tsx` navigates to `/careers` after a successful profile distillation API call. This is already well-gated (the API validates inputs). No retrofit needed.
