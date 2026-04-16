# Endpoint-Owned Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all input collection from the landing page's modal into the action endpoints themselves. Each endpoint checks the store on mount: has result → render; has required inputs → auto-run; missing inputs → show an input card. Landing cards become simple navigators. Chain-outs simplify to "set store + navigate."

**Architecture:** Three new input card components (GapAnalysisInputCard, LearningPathInputCard, CareersInputCard) handle the "missing inputs" state at their respective endpoints. The gap-analysis and learning-path pages gain auto-run-on-mount logic (matching the existing pattern in `/careers`). `ActionCards` is simplified to plain navigation. `MissingInputsModal`, `useGatedNavigate`, and `action-gate` are deleted. CareerNode and result-view chain-outs drop inline API calls.

**Tech Stack:** Next.js 14 App Router, Zustand, `react-hot-toast`, `lucide-react`, existing `LocalFileUpload`.

**Spec:** `docs/superpowers/specs/2026-04-16-endpoint-owned-inputs-design.md`

---

## File Structure

**New files:**
- `components/gap-analysis/GapAnalysisInputCard.tsx`
- `components/learning-path/LearningPathInputCard.tsx`
- `components/careers/CareersInputCard.tsx`

**Modified files:**
- `components/landing/ActionCards.tsx` — simplify to plain navigation, remove gate/modal props
- `app/page.tsx` — remove modal/gate, simplify to Hero + ActionCards + SessionBanner
- `app/gap-analysis/page.tsx` — add input card + auto-run on mount
- `app/learning-path/page.tsx` — add input card + auto-run on mount
- `app/careers/page.tsx` — replace "No careers yet" placeholder with input card
- `components/CareerNode.tsx` — simplify gap + learning chain-outs, remove useGatedNavigate
- `components/results/GapAnalysisView.tsx` — simplify learning-path chain-out, remove useGatedNavigate
- `components/results/LearningPathView.tsx` — simplify gap-analysis chain-out, remove useGatedNavigate
- `app/compare/page.tsx` — simplify gap chain-out, remove useGatedNavigate

**Deleted files:**
- `components/MissingInputsModal.tsx`
- `lib/use-gated-navigate.ts`
- `lib/action-gate.ts`
- `lib/action-gate.test.ts`

---

## Task 1: Simplify `ActionCards.tsx` and `app/page.tsx` — plain navigation

**Files:**
- Modify: `components/landing/ActionCards.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite `ActionCards.tsx` to use plain navigation**

Replace the entire file with:

```tsx
'use client';

import { useRouter } from 'next/navigation';
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
import type { ReactNode } from 'react';

type CardDef = {
  icon: ReactNode;
  title: string;
  description: string;
  hover: string;
  path: string;
  preNavigate?: () => void;
};

function ActionCard({ def, onClick }: { def: CardDef; onClick: () => void }) {
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

export default function ActionCards() {
  const router = useRouter();
  const store = useSessionStore();

  const discover: CardDef[] = [
    {
      icon: <Compass className='w-5 h-5' />,
      title: 'Find my careers',
      description: 'Generate 6 personalised career paths.',
      hover: 'Great starting point if you have a resume or know your interests.',
      path: '/careers',
      preNavigate: () => store.setCareers(null),
    },
    {
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
      icon: <MessageCircle className='w-5 h-5' />,
      title: 'Start chatting',
      description: 'Talk with the career advisor.',
      hover: 'Open-ended. Good if you are not sure where to begin.',
      path: '/chat',
    },
  ];

  const assess: CardDef[] = [
    {
      icon: <SearchCheck className='w-5 h-5' />,
      title: 'Gap analysis',
      description: 'What you have vs what you need.',
      hover: 'Needs a target role and a profile to compare against.',
      path: '/gap-analysis',
    },
    {
      icon: <RouteIcon className='w-5 h-5' />,
      title: 'Learning path',
      description: 'Step-by-step plan to get job-ready.',
      hover: 'Needs a target role. Uses your profile for context if available.',
      path: '/learning-path',
    },
    {
      icon: <Mic className='w-5 h-5' />,
      title: 'Practice interview',
      description: 'Simulate a job interview with feedback.',
      hover: 'Needs a target role. Uses your profile for richer questions.',
      path: '/interview',
    },
  ];

  const reflect: CardDef[] = [
    {
      icon: <Sparkles className='w-5 h-5' />,
      title: 'Imagine three lives',
      description: 'Three alternative five-year futures.',
      hover: 'From the Designing Your Life framework. Works with or without a profile.',
      path: '/odyssey',
    },
    {
      icon: <Users className='w-5 h-5' />,
      title: 'Board of advisors',
      description: 'Four perspectives on your profile.',
      hover: 'Needs a profile. A recruiter, HR partner, manager, and mentor each weigh in.',
      path: '/board',
    },
  ];

  function handleClick(def: CardDef) {
    def.preNavigate?.();
    router.push(def.path);
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

- [ ] **Step 2: Simplify `app/page.tsx`**

Replace the entire file with:

```tsx
'use client';

import Hero from '@/components/Hero';
import ActionCards from '@/components/landing/ActionCards';
import SessionBanner from '@/components/landing/SessionBanner';

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

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: may show errors for `action-gate` import being gone from ActionCards — that's correct, we removed it. May also show errors if `app/page.tsx` previously imported modal/gate. Both are expected to be clean after the rewrite. If tsc still references deleted imports elsewhere, those will be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add components/landing/ActionCards.tsx app/page.tsx
git commit -m "refactor(landing): simplify ActionCards to plain navigation, remove modal/gate"
```

---

## Task 2: `GapAnalysisInputCard` + auto-run on `/gap-analysis`

**Files:**
- Create: `components/gap-analysis/GapAnalysisInputCard.tsx`
- Modify: `app/gap-analysis/page.tsx`

- [ ] **Step 1: Create `GapAnalysisInputCard`**

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type GapAnalysis } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function GapAnalysisInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  const hasProfile = !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;
  const canRun = hasTarget && hasProfile;

  async function handleResumeSelect(file: File) {
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
  }

  async function handleRun() {
    if (!canRun) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setRunning(true);
    try {
      const llmConfig = await loadLLMConfig();
      const settings = await settingsStore.get();
      const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
      const res = await fetch('/api/gapAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          grounded,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gap analysis failed');
      }
      const { analysis, sources } = (await res.json()) as { analysis: GapAnalysis; sources?: any[] };
      store.setGapAnalysis(analysis);
      if (sources) store.setGapAnalysisSources(sources);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto px-6 py-16'>
      <div className='border border-border rounded-lg bg-paper p-6'>
        <div className='editorial-rule justify-center mb-2'>
          <span>Gap analysis</span>
        </div>
        <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
          What you have vs what you need
        </h2>
        <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
          Gap analysis needs a target (job title or job advert) and a profile (resume or about you). One of each is enough.
        </p>

        <div className='space-y-4'>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job title
            </label>
            <Input
              value={store.jobTitle}
              onChange={(e) => store.setJobTitle(e.target.value)}
              placeholder='e.g. Data analyst, UX researcher'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert
            </label>
            <Textarea
              value={store.jobAdvert}
              rows={3}
              onChange={(e) => store.setJobAdvert(e.target.value)}
              placeholder='Paste a job listing or description.'
              disabled={running}
            />
          </div>
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
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              About you
            </label>
            <Textarea
              value={store.freeText}
              rows={3}
              onChange={(e) => store.setFreeText(e.target.value)}
              placeholder='A sentence or two about your background, interests, or goals.'
              disabled={running}
            />
          </div>

          <div className='flex justify-center pt-2'>
            <Button onClick={handleRun} disabled={!canRun || running}>
              {running ? (
                <><LoadingDots color='white' /> Analysing…</>
              ) : (
                <><SearchCheck className='w-4 h-4 mr-2' /> Run gap analysis</>
              )}
            </Button>
          </div>

          {!canRun && (hasTarget || hasProfile) && (
            <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
              {!hasTarget ? 'Add a job title or job advert above.' : 'Add a resume or write something in About you.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/gap-analysis/page.tsx` with three states**

Replace the entire file:

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useSessionStore, type GapAnalysis } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import LoadingDots from '@/components/ui/loadingdots';
import GapAnalysisView from '@/components/results/GapAnalysisView';
import GapAnalysisInputCard from '@/components/gap-analysis/GapAnalysisInputCard';

export default function GapAnalysisPage() {
  const router = useRouter();
  const store = useSessionStore();
  const analysis = store.gapAnalysis;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  const hasProfile = !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;
  const canAutoRun = hasTarget && hasProfile && !analysis && !loading;

  useEffect(() => {
    if (!canAutoRun || autoRanRef.current) return;
    autoRanRef.current = true;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const settings = await settingsStore.get();
        const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
        const res = await fetch('/api/gapAnalysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobAdvert: store.jobAdvert || undefined,
            jobTitle: store.jobTitle || undefined,
            resume: store.resumeText ?? undefined,
            aboutYou: store.freeText || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            grounded,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Gap analysis failed');
        }
        const { analysis: result, sources } = (await res.json()) as {
          analysis: GapAnalysis;
          sources?: any[];
        };
        store.setGapAnalysis(result);
        if (sources) store.setGapAnalysisSources(sources);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoRun]);

  if (loading) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4'>
        <LoadingDots style='big' color='gray' />
        <p className='text-ink-muted'>Running gap analysis…</p>
        <Toaster />
      </div>
    );
  }

  if (analysis) {
    return (
      <div className='h-full overflow-y-auto'>
        <GapAnalysisView analysis={analysis} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <GapAnalysisInputCard />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add components/gap-analysis/GapAnalysisInputCard.tsx app/gap-analysis/page.tsx
git commit -m "feat(gap-analysis): add input card and auto-run on mount"
```

---

## Task 3: `LearningPathInputCard` + auto-run on `/learning-path`

**Files:**
- Create: `components/learning-path/LearningPathInputCard.tsx`
- Modify: `app/learning-path/page.tsx`

- [ ] **Step 1: Create `LearningPathInputCard`**

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type LearningPath } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function LearningPathInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  const canRun = hasTarget;

  async function handleResumeSelect(file: File) {
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
  }

  async function handleRun() {
    if (!canRun) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setRunning(true);
    try {
      const llmConfig = await loadLLMConfig();
      const settings = await settingsStore.get();
      const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
      const res = await fetch('/api/learningPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          grounded,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Learning path failed');
      }
      const { path, sources } = (await res.json()) as { path: LearningPath; sources?: any[] };
      store.setLearningPath(path);
      if (sources) store.setLearningPathSources(sources);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Learning path failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto px-6 py-16'>
      <div className='border border-border rounded-lg bg-paper p-6'>
        <div className='editorial-rule justify-center mb-2'>
          <span>Learning path</span>
        </div>
        <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
          Step-by-step plan to get job-ready
        </h2>
        <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
          Learning path needs a target role. Add a job title or paste a job advert. Profile is optional but helps with personalisation.
        </p>

        <div className='space-y-4'>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job title
            </label>
            <Input
              value={store.jobTitle}
              onChange={(e) => store.setJobTitle(e.target.value)}
              placeholder='e.g. Data analyst, UX researcher'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert
            </label>
            <Textarea
              value={store.jobAdvert}
              rows={3}
              onChange={(e) => store.setJobAdvert(e.target.value)}
              placeholder='Paste a job listing or description.'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Resume (optional)
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
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              About you (optional)
            </label>
            <Textarea
              value={store.freeText}
              rows={3}
              onChange={(e) => store.setFreeText(e.target.value)}
              placeholder='A sentence or two about your background.'
              disabled={running}
            />
          </div>

          <div className='flex justify-center pt-2'>
            <Button onClick={handleRun} disabled={!canRun || running}>
              {running ? (
                <><LoadingDots color='white' /> Building…</>
              ) : (
                <><RouteIcon className='w-4 h-4 mr-2' /> Build learning path</>
              )}
            </Button>
          </div>

          {!canRun && (
            <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
              Add a job title or job advert above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/learning-path/page.tsx` with three states**

Replace the entire file:

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useSessionStore, type LearningPath } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import LoadingDots from '@/components/ui/loadingdots';
import LearningPathView from '@/components/results/LearningPathView';
import LearningPathInputCard from '@/components/learning-path/LearningPathInputCard';

export default function LearningPathPage() {
  const router = useRouter();
  const store = useSessionStore();
  const path = store.learningPath;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  const canAutoRun = hasTarget && !path && !loading;

  useEffect(() => {
    if (!canAutoRun || autoRanRef.current) return;
    autoRanRef.current = true;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const settings = await settingsStore.get();
        const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
        const res = await fetch('/api/learningPath', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobAdvert: store.jobAdvert || undefined,
            jobTitle: store.jobTitle || undefined,
            resume: store.resumeText ?? undefined,
            aboutYou: store.freeText || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            grounded,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Learning path failed');
        }
        const { path: result, sources } = (await res.json()) as {
          path: LearningPath;
          sources?: any[];
        };
        store.setLearningPath(result);
        if (sources) store.setLearningPathSources(sources);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Learning path failed');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoRun]);

  if (loading) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4'>
        <LoadingDots style='big' color='gray' />
        <p className='text-ink-muted'>Building learning path…</p>
        <Toaster />
      </div>
    );
  }

  if (path) {
    return (
      <div className='h-full overflow-y-auto'>
        <LearningPathView path={path} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <LearningPathInputCard />
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add components/learning-path/LearningPathInputCard.tsx app/learning-path/page.tsx
git commit -m "feat(learning-path): add input card and auto-run on mount"
```

---

## Task 4: `CareersInputCard` + replace "No careers yet" on `/careers`

**Files:**
- Create: `components/careers/CareersInputCard.tsx`
- Modify: `app/careers/page.tsx`

- [ ] **Step 1: Create `CareersInputCard`**

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function CareersInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState(false);

  const hasAny =
    !!store.resumeText ||
    !!store.freeText.trim() ||
    !!store.jobTitle.trim() ||
    !!store.jobAdvert.trim();
  const canRun = hasAny;

  async function handleResumeSelect(file: File) {
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
  }

  async function handleRun() {
    if (!canRun) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setRunning(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/getCareers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          jobTitle: store.jobTitle || undefined,
          jobAdvert: store.jobAdvert || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate careers');
      }
      const data = await res.json();
      store.setCareers(data);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate careers');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto px-6 py-16'>
      <div className='border border-border rounded-lg bg-paper p-6'>
        <div className='editorial-rule justify-center mb-2'>
          <span>Find my careers</span>
        </div>
        <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
          Generate 6 personalised career paths
        </h2>
        <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
          Fill in any field below to get started. The more you provide, the more personalised the results.
        </p>

        <div className='space-y-4'>
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
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job title
            </label>
            <Input
              value={store.jobTitle}
              onChange={(e) => store.setJobTitle(e.target.value)}
              placeholder='e.g. Data analyst, UX researcher'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              About you
            </label>
            <Textarea
              value={store.freeText}
              rows={3}
              onChange={(e) => store.setFreeText(e.target.value)}
              placeholder='A sentence or two about your background, interests, or goals.'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert
            </label>
            <Textarea
              value={store.jobAdvert}
              rows={3}
              onChange={(e) => store.setJobAdvert(e.target.value)}
              placeholder='Paste a job listing or description.'
              disabled={running}
            />
          </div>

          <div className='flex justify-center pt-2'>
            <Button onClick={handleRun} disabled={!canRun || running}>
              {running ? (
                <><LoadingDots color='white' /> Generating…</>
              ) : (
                <><Compass className='w-4 h-4 mr-2' /> Find my careers</>
              )}
            </Button>
          </div>

          {!canRun && (
            <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
              Fill in any field above to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the "No careers yet" block in `app/careers/page.tsx`**

In `app/careers/page.tsx`, find the block:

```tsx
  if (!careers || careers.length === 0) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4'>
        <p className='text-ink-muted'>No careers yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }
```

Replace with:

```tsx
  if (!careers || careers.length === 0) {
    return (
      <div className='h-full overflow-y-auto'>
        <CareersInputCard />
        <Toaster />
      </div>
    );
  }
```

Add the import at the top:

```ts
import CareersInputCard from '@/components/careers/CareersInputCard';
```

Note: the existing auto-run `useEffect` on `/careers` already handles "has inputs + no careers → auto-generate." The `CareersInputCard` only shows when both the auto-run didn't fire (no inputs in store) AND no careers exist. When the student fills in inputs on the card and clicks Run, the card calls the API and writes careers to the store, which causes the parent page to re-render and show the ReactFlow graph.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add components/careers/CareersInputCard.tsx app/careers/page.tsx
git commit -m "feat(careers): replace 'No careers yet' with CareersInputCard"
```

---

## Task 5: Simplify chain-outs in `CareerNode.tsx`

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Read the file first**

Read `components/CareerNode.tsx` to see the current `handleAnalyseGaps` and `handleLearningPath` implementations (they run inline API calls).

- [ ] **Step 2: Simplify `handleAnalyseGaps`**

Replace the entire `handleAnalyseGaps` function (the async one that fetches `/api/gapAnalysis`):

```ts
  function handleAnalyseGaps() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    setGapAnalysis(null);
    router.push('/gap-analysis');
  }
```

- [ ] **Step 3: Simplify `handleLearningPath`**

Replace the entire `handleLearningPath` function (the async one that fetches `/api/learningPath`):

```ts
  function handleLearningPath() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    setLearningPath(null);
    router.push('/learning-path');
  }
```

Add `setLearningPath` to the store subscriptions near the top of the function:

```ts
  const setLearningPath = useSessionStore((s) => s.setLearningPath);
```

(Check if it's already there — it was used in the old inline API call.)

- [ ] **Step 4: Remove unused imports**

Since the chain-outs no longer run API calls inline, remove:
- `loadLLMConfig` import (if no other handler uses it — check `handleAnalyseGaps` and `handleLearningPath` were the only consumers)
- `toast` import (if no other handler uses it)
- `useState` for `running` (if the `running` state was only for gap/learn loading spinners — check whether the compare toggle or other handlers still use it)

Also remove:
- `MissingInputsModal` import (if present)
- `useGatedNavigate` import (if present)

Be careful: only remove imports that have no remaining consumers. Read the file to confirm.

- [ ] **Step 5: Update button labels**

The "Analyse gaps for this role" and "Learning path for this role" buttons previously showed loading text (`running === 'gaps' ? 'Analysing…' : ...`). Since these are now instant navigations (no local loading state), remove the conditional label:

```tsx
<Button variant='outline' onClick={handleAnalyseGaps}>
  <SearchCheck className='w-4 h-4 mr-2' />
  Analyse gaps for this role
</Button>
<Button variant='outline' onClick={handleLearningPath}>
  <RouteIcon className='w-4 h-4 mr-2' />
  Learning path for this role
</Button>
```

Remove the `disabled={running !== null}` from these two buttons (they're now instant).

- [ ] **Step 6: Remove `MissingInputsModal` render and `useGatedNavigate` hook call**

If `MissingInputsModal` is rendered in the JSX (from the earlier modal task), remove it. If `useGatedNavigate` is called, remove the hook call and its props.

The `handlePracticeInterview` and `handleBoardShortcut` functions should go back to direct navigation since the endpoint pages now own their inputs:

```ts
  function handlePracticeInterview() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    router.push('/interview');
  }

  function handleBoardShortcut() {
    useSessionStore.getState().setBoardPrefill({ focusRole: jobTitle });
    router.push('/board');
  }
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add components/CareerNode.tsx
git commit -m "refactor(careers): simplify CareerNode chain-outs to set-store-and-navigate"
```

---

## Task 6: Simplify chain-outs in result views + compare page

**Files:**
- Modify: `components/results/GapAnalysisView.tsx`
- Modify: `components/results/LearningPathView.tsx`
- Modify: `app/compare/page.tsx`

- [ ] **Step 1: Read all three files first**

Read each to find the chain-out functions and modal/gate imports.

- [ ] **Step 2: Simplify `GapAnalysisView.tsx`**

Replace `handleChainToLearningPath` (currently an async function running `/api/learningPath` inline):

```ts
  function handleChainToLearningPath() {
    store.setLearningPath(null);
    router.push('/learning-path');
  }
```

Remove the `chaining` state and the `loadLLMConfig` import if they're now unused. Remove `MissingInputsModal` import/render and `useGatedNavigate` hook if present.

The `handlePracticeInterview` function stays as a simple `router.push('/interview')` (no change needed — it was already simple, and the interview page has its own setup card).

Remove the loading state for the chain button ("Building…" label). It's now instant navigation:

```tsx
<Button variant='outline' onClick={handleChainToLearningPath}>
  <RouteIcon className='w-4 h-4 mr-2' />
  Build a learning path for this target
</Button>
```

- [ ] **Step 3: Simplify `LearningPathView.tsx`**

Replace `handleChainToGapAnalysis` (currently an async function running `/api/gapAnalysis` inline):

```ts
  function handleChainToGapAnalysis() {
    store.setGapAnalysis(null);
    router.push('/gap-analysis');
  }
```

Same cleanup: remove `chaining` state, `loadLLMConfig` import, `MissingInputsModal`/`useGatedNavigate` if present. Remove loading label on the chain button.

- [ ] **Step 4: Simplify `app/compare/page.tsx`**

Replace `handleGapForRole`:

```ts
  function handleGapForRole(label: string) {
    store.setJobTitle(label);
    store.setGapAnalysis(null);
    router.push('/gap-analysis');
  }
```

Remove `MissingInputsModal` import/render and `useGatedNavigate` hook if present.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add components/results/GapAnalysisView.tsx components/results/LearningPathView.tsx app/compare/page.tsx
git commit -m "refactor(chain-outs): simplify result-view and compare chains to set-store-and-navigate"
```

---

## Task 7: Delete modal/gate infrastructure

**Files:**
- Delete: `components/MissingInputsModal.tsx`
- Delete: `lib/use-gated-navigate.ts`
- Delete: `lib/action-gate.ts`
- Delete: `lib/action-gate.test.ts`

- [ ] **Step 1: Delete the files**

```bash
rm components/MissingInputsModal.tsx
rm lib/use-gated-navigate.ts
rm lib/action-gate.ts
rm lib/action-gate.test.ts
```

- [ ] **Step 2: Search for stale imports**

```bash
grep -r "MissingInputsModal\|useGatedNavigate\|action-gate\|GatedAction\|checkGate" --include="*.tsx" --include="*.ts" components/ app/ lib/
```

If any stale imports remain, remove them. All consumers should have been updated in Tasks 1, 5, and 6.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run`

Expected: TypeScript clean, tests pass. The `action-gate.test.ts` tests will be gone (deleted). All other tests should still pass.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor: delete MissingInputsModal, useGatedNavigate, and action-gate"
```

---

## Task 8: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS (test count will be lower since action-gate tests are deleted).

- [ ] **Step 2: Start the app**

Run: `npm run electron:dev`

- [ ] **Step 3: Walk the QA checklist**

- [ ] Click "Gap analysis" with no inputs → navigate to /gap-analysis → input card shows with helper
- [ ] Fill job title + resume on the input card → Run → loading → results render
- [ ] Navigate back to landing → session banner shows inputs + "gap analysis ready"
- [ ] Click "Gap analysis" again → auto-runs immediately (inputs present, previous result cleared by landing card) → new results
- [ ] Click "Learning path" with no inputs → input card shows
- [ ] Fill job title → Run → results
- [ ] Click "Find my careers" with no inputs → input card shows on /careers
- [ ] Fill any one field → Run → careers generate, spider graph renders
- [ ] Click "Start chatting" → immediate navigation to /chat
- [ ] Click "Imagine three lives" → immediate navigation to /odyssey
- [ ] Click "Board of advisors" → board input card shows (BoardInputCard, existing)
- [ ] Click "Compare careers" → compare input card shows (CompareInputCard, existing)
- [ ] Click "Practice interview" → interview setup card shows (existing)
- [ ] Career card "Analyse gaps for this role" → /gap-analysis auto-runs (jobTitle was set)
- [ ] Career card "Learning path for this role" → /learning-path auto-runs
- [ ] Career card "Practice interview" → /interview setup card
- [ ] Career card "Ask the board about this role" → /board input card with focus pre-filled
- [ ] Gap analysis "Build learning path" chain → /learning-path auto-runs
- [ ] Learning path "Run gap analysis" chain → /gap-analysis auto-runs (or shows input card if profile missing)
- [ ] Compare "Analyse gaps for Data analyst" → /gap-analysis auto-runs or shows input card
- [ ] Remove resume via SessionBanner × → click Gap analysis → input card shows (profile missing)
- [ ] Start over → outputs cleared, inputs preserved
- [ ] No MissingInputsModal appears anywhere in the app
- [ ] No `action-gate` console errors or import failures
- [ ] All 8 landing cards navigate correctly
- [ ] All feature endpoints work correctly
- [ ] Electron dev build end to end

- [ ] **Step 4: Fix any QA findings**

---

## Notes for the implementer

- **`fileToArrayBuffer` is duplicated** in each input card. This is intentional — the function is 5 lines and extracting it to a shared utility adds import overhead for negligible DRY benefit. If it bothers you, extract to `lib/utils.ts` (which may already export it — check before creating a new one).
- **Auto-run uses `autoRanRef`** to prevent double-fire in React Strict Mode. Same pattern as the compare page's `consumedRef`. Don't remove it.
- **The careers page already has auto-run logic.** `CareersInputCard` is only shown when the auto-run didn't fire (no inputs). When the student fills inputs on the card and clicks Run, the card's `handleRun` fires the API. The page's existing `useEffect` won't re-fire because the card writes careers directly via `store.setCareers(data)`.
- **Grounding flag** for gap analysis and learning path: read from `settingsStore.get()` the same way the old ActionsZone handlers did. The input cards replicate this logic.
- **`running` state in CareerNode:** if it was only used for gap/learn loading, it can be removed entirely. If the compare toggle or other handlers used it, keep it. Read carefully before deleting.
- **Chain-out buttons in result views** no longer show loading labels ("Building…", "Analysing…"). They're instant navigations now. The endpoint pages show their own loading states.
- **`store.setGapAnalysis(null)` before navigating** is important: it clears the previous result so the page's mount logic sees "no result" and either auto-runs or shows the input card. Without it, the page would render the stale result.
