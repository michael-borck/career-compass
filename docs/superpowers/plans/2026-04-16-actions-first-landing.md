# Actions-First Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's form-first layout (InputsZone + ActionsZone + OutputsBanner) with an actions-first layout (Hero + three-pillar ActionCards + merged SessionBanner). All input collection moves to the existing MissingInputsModal.

**Architecture:** New `ActionCards.tsx` renders 8 action cards in three columns (Discover / Assess / Reflect). New `SessionBanner.tsx` merges input pills (with × remove) and output links into one strip. New `resetOutputs()` store action clears results but preserves inputs. Old components (`InputsZone`, `ActionsZone`, `OutputsBanner`, `ActionWillUse`) are deleted. Landing page assembly in `app/page.tsx` is simplified.

**Tech Stack:** Next.js 14 App Router, Zustand, Vitest, `lucide-react`, existing `MissingInputsModal` + `useGatedNavigate`.

**Spec:** `docs/superpowers/specs/2026-04-16-actions-first-landing-design.md`

---

## File Structure

**New files:**
- `components/landing/ActionCards.tsx` — three-pillar grid with 8 action cards
- `components/landing/SessionBanner.tsx` — merged inputs + outputs strip

**Modified files:**
- `lib/session-store.ts` — add `resetOutputs()` action
- `lib/session-store.test.ts` — test `resetOutputs()`
- `app/page.tsx` — swap assembly
- `components/Hero.tsx` — update subtitle copy

**Deleted files:**
- `components/landing/InputsZone.tsx`
- `components/landing/ActionsZone.tsx`
- `components/landing/OutputsBanner.tsx`
- `components/landing/ActionWillUse.tsx`

---

## Task 1: `resetOutputs()` store action

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
describe('resetOutputs', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('preserves input fields', () => {
    useSessionStore.getState().setResume('resume text', 'resume.pdf');
    useSessionStore.getState().setFreeText('I am a student');
    useSessionStore.getState().setJobTitle('Data analyst');
    useSessionStore.getState().setJobAdvert('We are hiring...');
    useSessionStore.getState().setUrlInput('https://example.com');
    useSessionStore.getState().setUrlFetchedTitle('Example');

    useSessionStore.getState().resetOutputs();

    const s = useSessionStore.getState();
    expect(s.resumeText).toBe('resume text');
    expect(s.resumeFilename).toBe('resume.pdf');
    expect(s.freeText).toBe('I am a student');
    expect(s.jobTitle).toBe('Data analyst');
    expect(s.jobAdvert).toBe('We are hiring...');
    expect(s.urlInput).toBe('https://example.com');
    expect(s.urlFetchedTitle).toBe('Example');
  });

  it('clears all output fields', () => {
    useSessionStore.getState().setJobTitle('Analyst');
    useSessionStore.getState().setCareers([{
      jobTitle: 'Test', jobDescription: 'd', timeline: 't', salary: 's',
      difficulty: 'd', workRequired: 'w', aboutTheRole: 'a',
      whyItsagoodfit: [], roadmap: [],
    }]);
    useSessionStore.getState().addChatMessage({ role: 'user', content: 'hi' });
    useSessionStore.getState().setGapAnalysis({
      target: 't', summary: 's', matches: [], gaps: [], realisticTimeline: 'r',
    });
    useSessionStore.getState().setLearningPath({
      target: 't', summary: 's', prerequisites: [], milestones: [],
      portfolioProject: '', totalDuration: '', caveats: [],
    });
    useSessionStore.getState().setInterviewFeedback({
      target: 't', difficulty: 'standard', summary: 's', strengths: [],
      improvements: [], perPhase: [], overallRating: 'on-track', nextSteps: [],
    });
    useSessionStore.getState().setBoardReview({
      framing: 'f', focusRole: null,
      voices: [
        { role: 'recruiter', name: 'R', response: 'r' },
        { role: 'hr', name: 'H', response: 'h' },
        { role: 'manager', name: 'M', response: 'm' },
        { role: 'mentor', name: 'Me', response: 'me' },
      ],
      synthesis: { agreements: ['a'], disagreements: [], topPriorities: [] },
    });
    useSessionStore.getState().setComparison({
      mode: 'quick',
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
        { label: 'B', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    useSessionStore.getState().setOdysseySeed('current', 'L', 'seed');
    useSessionStore.getState().setDistilledProfile({
      background: 'b', interests: [], skills: [], constraints: [], goals: [],
    });
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().setBoardPrefill({ framing: 'f' });
    useSessionStore.getState().setComparePrefill({ seedTarget: 's' });

    useSessionStore.getState().resetOutputs();

    const s = useSessionStore.getState();
    expect(s.careers).toBeNull();
    expect(s.chatMessages).toEqual([]);
    expect(s.currentFocus).toBeNull();
    expect(s.distilledProfile).toBeNull();
    expect(s.selectedCareerId).toBeNull();
    expect(s.gapAnalysis).toBeNull();
    expect(s.learningPath).toBeNull();
    expect(s.interviewMessages).toEqual([]);
    expect(s.interviewTarget).toBeNull();
    expect(s.interviewPhase).toBeNull();
    expect(s.interviewFeedback).toBeNull();
    expect(s.boardReview).toBeNull();
    expect(s.boardPrefill).toBeNull();
    expect(s.comparison).toBeNull();
    expect(s.comparePrefill).toBeNull();
    expect(s.comparing).toEqual([]);
    expect(s.odysseyLives.current.label).toBe('');
    expect(s.odysseyLives.current.seed).toBe('');
    expect(s.gapAnalysisSources).toBeNull();
    expect(s.learningPathSources).toBeNull();
    expect(s.interviewSources).toEqual([]);
    expect(s.chatSources).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/session-store.test.ts`
Expected: FAIL — `resetOutputs` is not a function.

- [ ] **Step 3: Add `resetOutputs` to the session store**

Add to the `SessionState` actions section (near `reset`):

```ts
  resetOutputs: () => void;
```

Add the implementation inside `create<SessionState>((set, get) => ({...}))`, near the existing `reset`:

```ts
  resetOutputs: () => {
    const s = get();
    set({
      ...initialState,
      resumeText: s.resumeText,
      resumeFilename: s.resumeFilename,
      freeText: s.freeText,
      jobTitle: s.jobTitle,
      jobAdvert: s.jobAdvert,
      urlInput: s.urlInput,
      urlFetchedTitle: s.urlFetchedTitle,
    });
  },
```

This spreads `initialState` (clearing everything) then overwrites the seven input fields with their current values.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/session-store.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add resetOutputs action preserving inputs"
```

---

## Task 2: `ActionCards.tsx` — three-pillar grid

**Files:**
- Create: `components/landing/ActionCards.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import {
  Compass,
  Columns3,
  MessageCircle,
  SearchCheck,
  Route as RouteIcon,
  Mic,
  Sparkles,
  Users,
} from 'lucide-react';
import { useSessionStore } from '@/lib/session-store';
import type { GatedAction } from '@/lib/action-gate';
import type { ReactNode } from 'react';

type CardDef = {
  action: GatedAction | 'chat' | 'odyssey';
  icon: ReactNode;
  title: string;
  description: string;
  hover: string;
  path: string;
  preNavigate?: () => void;
};

type Props = {
  gatedPush: (action: GatedAction, path: string, preNavigate?: () => void) => void;
  onDirectPush: (path: string) => void;
};

function ActionCard({
  def,
  onClick,
}: {
  def: CardDef;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={def.hover}
      className='border border-border rounded-lg bg-paper p-5 hover:border-ink-muted transition-colors duration-[250ms] cursor-pointer text-left w-full'
    >
      <div className='text-accent mb-3'>{def.icon}</div>
      <h3 className='text-[var(--text-base)] font-semibold text-ink mb-1'>{def.title}</h3>
      <p className='text-[var(--text-sm)] text-ink-muted leading-snug'>{def.description}</p>
    </button>
  );
}

export default function ActionCards({ gatedPush, onDirectPush }: Props) {
  const store = useSessionStore();

  const discover: CardDef[] = [
    {
      action: 'careers',
      icon: <Compass className='w-5 h-5' />,
      title: 'Find my careers',
      description: 'Generate 6 personalised career paths.',
      hover: 'Great starting point if you have a resume or know your interests.',
      path: '/careers',
      preNavigate: () => store.setCareers(null),
    },
    {
      action: 'compare',
      icon: <Columns3 className='w-5 h-5' />,
      title: 'Compare careers',
      description: 'Side-by-side across seven dimensions.',
      hover: 'Quick compare from job titles, or rich compare from your generated careers.',
      path: '/compare',
      preNavigate: () =>
        store.setComparePrefill({
          seedTarget: store.jobAdvert.trim() || store.jobTitle.trim(),
        }),
    },
    {
      action: 'chat',
      icon: <MessageCircle className='w-5 h-5' />,
      title: 'Start chatting',
      description: 'Talk with the career advisor.',
      hover: 'Open-ended. Good if you are not sure where to begin.',
      path: '/chat',
    },
  ];

  const assess: CardDef[] = [
    {
      action: 'gaps',
      icon: <SearchCheck className='w-5 h-5' />,
      title: 'Gap analysis',
      description: 'What you have vs what you need.',
      hover: 'Needs a target role and a profile to compare against.',
      path: '/gap-analysis',
    },
    {
      action: 'learn',
      icon: <RouteIcon className='w-5 h-5' />,
      title: 'Learning path',
      description: 'Step-by-step plan to get job-ready.',
      hover: 'Needs a target role. Uses your profile for context if available.',
      path: '/learning-path',
    },
    {
      action: 'interview',
      icon: <Mic className='w-5 h-5' />,
      title: 'Practice interview',
      description: 'Simulate a job interview with feedback.',
      hover: 'Needs a target role. Uses your profile for richer questions.',
      path: '/interview',
    },
  ];

  const reflect: CardDef[] = [
    {
      action: 'odyssey',
      icon: <Sparkles className='w-5 h-5' />,
      title: 'Imagine three lives',
      description: 'Three alternative five-year futures.',
      hover: 'From the Designing Your Life framework. Works with or without a profile.',
      path: '/odyssey',
    },
    {
      action: 'board',
      icon: <Users className='w-5 h-5' />,
      title: 'Board of advisors',
      description: 'Four perspectives on your profile.',
      hover: 'Needs a profile. A recruiter, HR partner, manager, and mentor each weigh in.',
      path: '/board',
    },
  ];

  function handleClick(def: CardDef) {
    if (def.action === 'chat' || def.action === 'odyssey') {
      onDirectPush(def.path);
      return;
    }
    gatedPush(def.action as GatedAction, def.path, def.preNavigate);
  }

  function renderColumn(label: string, cards: CardDef[]) {
    return (
      <div>
        <div className='editorial-rule justify-center mb-3'>
          <span>{label}</span>
        </div>
        <div className='flex flex-col gap-3'>
          {cards.map((def) => (
            <ActionCard key={def.title} def={def} onClick={() => handleClick(def)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 mt-6'>
      {renderColumn('Discover', discover)}
      {renderColumn('Assess', assess)}
      {renderColumn('Reflect', reflect)}
    </div>
  );
}
```

Note on the `Props` type: `gatedPush` comes from `useGatedNavigate()` and handles actions that need gating. `onDirectPush` is a plain `router.push` for ungated actions (chat, odyssey). The parent wires both.

Note on `compare` preNavigate: it reads the current store state to build the `seedTarget`. If the store has no target at click time, `seedTarget` will be empty string. That's fine — the `/compare` page handles an empty seedTarget by showing the input card with empty slots.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/ActionCards.tsx
git commit -m "feat(landing): add ActionCards three-pillar grid with 8 action cards"
```

---

## Task 3: `SessionBanner.tsx` — merged inputs + outputs strip

**Files:**
- Create: `components/landing/SessionBanner.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';

export default function SessionBanner() {
  const store = useSessionStore();
  const {
    resumeText,
    resumeFilename,
    freeText,
    jobTitle,
    jobAdvert,
    careers,
    chatMessages,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
    odysseyLives,
    boardReview,
    comparison,
  } = store;

  // Inputs
  const hasResume = !!resumeText;
  const hasFreeText = !!freeText.trim();
  const hasJobTitle = !!jobTitle.trim();
  const hasJobAdvert = !!jobAdvert.trim();
  const hasAnyInput = hasResume || hasFreeText || hasJobTitle || hasJobAdvert;

  // Outputs
  const hasCareers = !!(careers && careers.length > 0);
  const userMessageCount = chatMessages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const hasChat = userMessageCount > 0;
  const hasGap = !!gapAnalysis;
  const hasPath = !!learningPath;
  const hasInterviewFeedback = !!interviewFeedback;
  const hasInterviewInProgress =
    interviewMessages.length > 0 && !hasInterviewFeedback;
  const hasOdyssey = Object.values(odysseyLives).some(
    (life) => life.seed.trim() || life.headline
  );
  const hasBoard = !!boardReview;
  const hasComparison = !!comparison;
  const hasAnyOutput =
    hasCareers ||
    hasChat ||
    hasGap ||
    hasPath ||
    hasInterviewInProgress ||
    hasInterviewFeedback ||
    hasOdyssey ||
    hasBoard ||
    hasComparison;

  if (!hasAnyInput && !hasAnyOutput) return null;

  function handleStartOver() {
    if (!confirm('Start over? This clears your results but keeps your uploaded material.'))
      return;
    store.resetOutputs();
  }

  const pillClass =
    'inline-flex items-center gap-1 bg-paper border border-border rounded px-2 py-0.5 text-[var(--text-xs)] text-ink';
  const removeClass =
    'text-ink-quiet hover:text-ink cursor-pointer ml-1';

  return (
    <div className='w-full max-w-5xl mx-auto mt-8 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4 flex-wrap'>
      <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />

      {/* Input pills */}
      {hasAnyInput && (
        <div className='flex flex-wrap gap-x-2 gap-y-1 items-center'>
          <span className='text-[var(--text-xs)] text-ink-quiet'>Loaded:</span>
          {hasResume && (
            <span className={pillClass}>
              {resumeFilename ?? 'resume'}
              <button
                type='button'
                onClick={() => store.clearResume()}
                className={removeClass}
                aria-label='Remove resume'
              >
                ×
              </button>
            </span>
          )}
          {hasFreeText && (
            <span className={pillClass}>
              About you
              <button
                type='button'
                onClick={() => store.setFreeText('')}
                className={removeClass}
                aria-label='Remove about you'
              >
                ×
              </button>
            </span>
          )}
          {hasJobTitle && (
            <span className={pillClass}>
              Job title: {jobTitle.trim().slice(0, 30)}
              {jobTitle.trim().length > 30 ? '…' : ''}
              <button
                type='button'
                onClick={() => store.setJobTitle('')}
                className={removeClass}
                aria-label='Remove job title'
              >
                ×
              </button>
            </span>
          )}
          {hasJobAdvert && (
            <span className={pillClass}>
              Job advert
              <button
                type='button'
                onClick={() => store.setJobAdvert('')}
                className={removeClass}
                aria-label='Remove job advert'
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Divider between inputs and outputs */}
      {hasAnyInput && hasAnyOutput && (
        <span className='text-ink-quiet'>·</span>
      )}

      {/* Output links */}
      {hasAnyOutput && (
        <div className='flex-1 text-[var(--text-xs)] text-ink flex flex-wrap gap-x-3 gap-y-1 items-center'>
          <span className='text-ink-quiet'>You have:</span>
          {hasCareers && (
            <Link href='/careers' className='underline hover:text-accent'>
              {careers!.length} careers
            </Link>
          )}
          {hasChat && (
            <Link href='/chat' className='underline hover:text-accent'>
              {userMessageCount} chat message{userMessageCount === 1 ? '' : 's'}
            </Link>
          )}
          {hasGap && (
            <Link href='/gap-analysis' className='underline hover:text-accent'>
              gap analysis ready
            </Link>
          )}
          {hasPath && (
            <Link href='/learning-path' className='underline hover:text-accent'>
              learning path ready
            </Link>
          )}
          {hasInterviewInProgress && (
            <Link href='/interview' className='underline hover:text-accent'>
              interview in progress
            </Link>
          )}
          {hasInterviewFeedback && (
            <Link href='/interview' className='underline hover:text-accent'>
              interview feedback ready
            </Link>
          )}
          {hasOdyssey && (
            <Link href='/odyssey' className='underline hover:text-accent'>
              odyssey plan in progress
            </Link>
          )}
          {hasBoard && (
            <Link href='/board' className='underline hover:text-accent'>
              board review ready
            </Link>
          )}
          {hasComparison && (
            <Link href='/compare' className='underline hover:text-accent'>
              comparison ready
            </Link>
          )}
        </div>
      )}

      {/* Start over */}
      {hasAnyOutput && (
        <button
          type='button'
          onClick={handleStartOver}
          className='text-[var(--text-xs)] text-ink-muted hover:text-ink flex-shrink-0'
        >
          Start over
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/SessionBanner.tsx
git commit -m "feat(landing): add SessionBanner with input pills and output links"
```

---

## Task 4: Update Hero subtitle

**Files:**
- Modify: `components/Hero.tsx`

- [ ] **Step 1: Update the subtitle**

In `components/Hero.tsx`, replace the subtitle paragraph:

```tsx
        <p className='mt-5 max-w-xl mx-auto text-ink-muted text-[var(--text-base)] leading-relaxed'>
          AI-powered career exploration that never leaves your device.
        </p>
```

with:

```tsx
        <p className='mt-5 max-w-xl mx-auto text-ink-muted text-[var(--text-base)] leading-relaxed'>
          Explore what's possible. Understand what it takes. Reflect on what fits.
        </p>
```

- [ ] **Step 2: Commit**

```bash
git add components/Hero.tsx
git commit -m "style(hero): update subtitle to echo the three-pillar workflow"
```

---

## Task 5: Swap landing page assembly + delete old components

**Files:**
- Modify: `app/page.tsx`
- Delete: `components/landing/InputsZone.tsx`
- Delete: `components/landing/ActionsZone.tsx`
- Delete: `components/landing/OutputsBanner.tsx`
- Delete: `components/landing/ActionWillUse.tsx`

- [ ] **Step 1: Rewrite `app/page.tsx`**

Replace the entire contents of `app/page.tsx` with:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import Hero from '@/components/Hero';
import ActionCards from '@/components/landing/ActionCards';
import SessionBanner from '@/components/landing/SessionBanner';
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';

export default function Home() {
  const router = useRouter();
  const { gatedPush, modalProps } = useGatedNavigate();

  function onDirectPush(path: string) {
    router.push(path);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <ActionCards gatedPush={gatedPush} onDirectPush={onDirectPush} />
        <SessionBanner />
      </section>
      <MissingInputsModal {...modalProps} />
    </div>
  );
}
```

- [ ] **Step 2: Delete the old components**

Run these commands:

```bash
rm components/landing/InputsZone.tsx
rm components/landing/ActionsZone.tsx
rm components/landing/OutputsBanner.tsx
rm components/landing/ActionWillUse.tsx
```

- [ ] **Step 3: Check for stale imports across the codebase**

Search for any remaining imports of the deleted files:

```bash
grep -r "InputsZone\|ActionsZone\|OutputsBanner\|ActionWillUse" --include="*.tsx" --include="*.ts" components/ app/ lib/
```

If any are found (should be none — these were only used in `app/page.tsx` which we just rewrote), remove the stale imports.

- [ ] **Step 4: Verify everything type-checks and tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: TypeScript clean, all tests green. Some tests in `lib/session-store.test.ts` may import from deleted files — check and remove if so. (The store tests import from `./session-store`, not from `InputsZone`, so they should be fine.)

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git add -u components/landing/
git commit -m "feat(landing): swap to actions-first layout, delete InputsZone/ActionsZone/OutputsBanner/ActionWillUse"
```

---

## Task 6: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 2: Start the app**

Run: `npm run electron:dev`

- [ ] **Step 3: Walk the manual QA checklist from the spec**

- [ ] First visit: no banner, hero + three pillars only
- [ ] Three columns on desktop: Discover (3 cards) | Assess (3 cards) | Reflect (2 cards)
- [ ] Card order: Discover = Find my careers, Compare careers, Start chatting. Assess = Gap analysis, Learning path, Practice interview. Reflect = Imagine three lives, Board of advisors.
- [ ] Mobile viewport: pillars stack vertically with section headers
- [ ] Hover on each card shows extended description tooltip
- [ ] Hero subtitle reads "Explore what's possible. Understand what it takes. Reflect on what fits."
- [ ] Click "Start chatting" → navigates immediately to `/chat`
- [ ] Click "Imagine three lives" → navigates immediately to `/odyssey`
- [ ] Click "Gap analysis" with no inputs → modal opens showing target + profile fields
- [ ] Fill resume in modal → Continue activates → click → navigates to `/gap-analysis`
- [ ] Return to landing → session banner shows "Loaded: resume.pdf ×" and "You have: gap analysis ready"
- [ ] Click × on resume → pill disappears, resume cleared from store
- [ ] Click "Board of advisors" → modal opens (resume was just cleared, needs profile)
- [ ] Fill about-you in modal → Continue → navigates to `/board`
- [ ] Return to landing → banner shows "Loaded: About you ×" and "board review ready"
- [ ] Click "Find my careers" → modal opens (needs at least a target) → fill job title → Continue → navigates to `/careers`
- [ ] Return to landing → banner shows "Loaded: About you × · Job title: Data analyst ×" and "You have: 6 careers"
- [ ] Click "Compare careers" → modal may open if no target (but job title is loaded, so should proceed) → navigates to `/compare`
- [ ] Start over → confirmation "clears results but keeps uploaded material" → output links disappear, input pills remain
- [ ] After start over, click "Gap analysis" → resume/about-you still loaded, modal only asks for target (if jobTitle was cleared by ×)
- [ ] No InputsZone visible anywhere on the page
- [ ] No red highlight pattern anywhere
- [ ] All 8 action cards navigate to correct endpoints
- [ ] All feature endpoints still work correctly
- [ ] Chain-outs from feature endpoints (career card shortcuts, result-view chains) still work
- [ ] Electron dev build end to end

- [ ] **Step 4: Fix any QA findings**

If any behaviour is wrong, commit fixes separately.

---

## Notes for the implementer

- **`InputsZone.tsx` exports `MissingHints` and `NO_HINTS`** — these types were used by `ActionsZone` and `app/page.tsx`. Both consumers are being deleted/rewritten, so the types become dead code and the file can be safely deleted.
- **`ActionWillUse.tsx` exports `ActionId`** — this type was only consumed by `ActionsZone.tsx`. Safe to delete.
- **`OutputsBanner.tsx`** was only used in `app/page.tsx`. Safe to delete.
- **The `Toaster` component** is not rendered on the landing page currently — toasts from the modal come from `react-hot-toast` which is already mounted in the feature endpoints. If QA shows missing toasts on the landing page (e.g., from the modal's resume upload failure), add `<Toaster />` to `app/page.tsx`.
- **`onDirectPush`** is a thin wrapper around `router.push`. It exists because `ActionCards` shouldn't import `useRouter` directly — the parent owns navigation. If the implementer prefers passing `router` directly, that's fine too — the important thing is that chat and odyssey bypass the gate.
- **The `compare` card's `preNavigate`** reads the store at click time to build `seedTarget`. If no target exists (student clicked Compare with nothing loaded), `seedTarget` will be empty string. The `/compare` page handles this gracefully by showing the input card with empty slots.
- **Studio Calm tokens only.** `bg-paper`, `border-border`, `text-ink`, `text-ink-muted`, `text-ink-quiet`, `text-accent`, `bg-accent-soft`. No raw hex. No emoji in the real implementation — use Lucide icons.
- **The `.editorial-rule.justify-center`** class is used for pillar headers, same as every other section header in the app.
