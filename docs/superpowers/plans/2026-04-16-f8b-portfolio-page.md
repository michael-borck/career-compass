# F8b Portfolio Page Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a portfolio page generator that produces a standalone HTML file from the student's profile, previews it in a sandboxed iframe, and saves it as a downloadable `.html` file. Personal from landing, role-tailored from career card dropdown.

**Architecture:** One new route (`/portfolio`) following the endpoint-owned-inputs pattern. The LLM returns raw HTML (not JSON), so no parser is needed — just a prompt builder and a sanity check in the API route. Preview via `srcdoc` iframe. File save via blob download. Fourth card in the Materials pillar + career card dropdown entry.

**Tech Stack:** Next.js 14 App Router, Zustand, Vitest, `lucide-react` (`Globe`), sandboxed iframe with `srcdoc`.

**Spec:** `docs/superpowers/specs/2026-04-16-f8b-portfolio-page-design.md`

---

## File Structure

**New files:**
- `lib/prompts/portfolio.ts` + `lib/prompts/portfolio.test.ts`
- `app/api/portfolio/route.ts`
- `app/portfolio/page.tsx`
- `components/portfolio/PortfolioInputCard.tsx`
- `components/portfolio/PortfolioPreview.tsx`

**Modified files:**
- `lib/session-store.ts` + `lib/session-store.test.ts` — `Portfolio` type + field + action
- `components/landing/ActionCards.tsx` — add Portfolio card to Materials pillar
- `components/landing/SessionBanner.tsx` — add portfolio link
- `components/CareerNode.tsx` — add portfolio entry to dropdown

---

## Task 1: Session store — Portfolio type, field, action

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
describe('portfolio', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('portfolio initialises null', () => {
    expect(useSessionStore.getState().portfolio).toBeNull();
  });

  it('setPortfolio writes and clears', () => {
    const p = { html: '<html>test</html>', target: 'Data analyst' };
    useSessionStore.getState().setPortfolio(p);
    expect(useSessionStore.getState().portfolio).toEqual(p);
    useSessionStore.getState().setPortfolio(null);
    expect(useSessionStore.getState().portfolio).toBeNull();
  });

  it('setPortfolio stores null target for personal portfolio', () => {
    useSessionStore.getState().setPortfolio({ html: '<html></html>', target: null });
    expect(useSessionStore.getState().portfolio?.target).toBeNull();
  });

  it('reset() clears portfolio', () => {
    useSessionStore.getState().setPortfolio({ html: '<html></html>', target: null });
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().portfolio).toBeNull();
  });

  it('resetOutputs() clears portfolio but preserves inputs', () => {
    useSessionStore.getState().setPortfolio({ html: '<html></html>', target: 'Analyst' });
    useSessionStore.getState().setResume('r', 'r.pdf');
    useSessionStore.getState().resetOutputs();
    expect(useSessionStore.getState().portfolio).toBeNull();
    expect(useSessionStore.getState().resumeText).toBe('r');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/session-store.test.ts` — expect FAIL.

- [ ] **Step 3: Add type, field, and action**

Add type above `SessionState`:

```ts
export type Portfolio = {
  html: string;
  target: string | null;
};
```

Add to `SessionState`:

```ts
  // Portfolio
  portfolio: Portfolio | null;
```

Add action:

```ts
  setPortfolio: (p: Portfolio | null) => void;
```

Add to `initialState`:

```ts
  portfolio: null,
```

Add implementation:

```ts
  setPortfolio: (p) => set({ portfolio: p }),
```

`reset()` and `resetOutputs()` clear automatically.

- [ ] **Step 4:** Run `npx vitest run lib/session-store.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add Portfolio type, field, and action"
```

---

## Task 2: Prompt builder (TDD)

**Files:**
- Create: `lib/prompts/portfolio.ts`
- Create: `lib/prompts/portfolio.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/prompts/portfolio.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPortfolioPrompt } from './portfolio';

describe('buildPortfolioPrompt', () => {
  it('includes resume when provided', () => {
    const out = buildPortfolioPrompt({ resume: 'Three years at Curtin University.' });
    expect(out).toContain('Curtin');
  });

  it('includes about-me when provided', () => {
    const out = buildPortfolioPrompt({ freeText: 'I enjoy working with data.' });
    expect(out).toContain('working with data');
  });

  it('includes target role when provided', () => {
    const out = buildPortfolioPrompt({ resume: 'r', jobTitle: 'Data analyst' });
    expect(out).toContain('Data analyst');
  });

  it('includes job advert when provided', () => {
    const out = buildPortfolioPrompt({ resume: 'r', jobAdvert: 'Hiring at Acme Corp.' });
    expect(out).toContain('Acme Corp');
  });

  it('asks for standalone HTML with inline CSS', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toMatch(/standalone.*HTML/i);
    expect(out).toMatch(/inline/i);
    expect(out).toMatch(/<style>/i);
  });

  it('specifies the design: dark navy header, system fonts', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toContain('#1a2332');
    expect(out).toContain('system');
  });

  it('includes all six section names', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toContain('Hero');
    expect(out).toContain('About Me');
    expect(out).toContain('Key Experience');
    expect(out).toContain('Skills');
    expect(out).toMatch(/What I.*Looking For/);
    expect(out).toContain('Contact');
  });

  it('asks to start with DOCTYPE', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toContain('<!DOCTYPE html>');
  });

  it('includes distilled profile when provided', () => {
    const out = buildPortfolioPrompt({
      resume: 'r',
      distilledProfile: {
        background: 'Public health undergrad',
        interests: ['community health'],
        skills: ['statistics'],
        constraints: [],
        goals: ['policy role'],
      },
    });
    expect(out).toMatch(/public health/i);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/prompts/portfolio.test.ts` — expect FAIL.

- [ ] **Step 3: Implement `lib/prompts/portfolio.ts`**

```ts
import type { StudentProfile } from '@/lib/session-store';

export type PortfolioInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildProfileSection(input: PortfolioInput): string {
  const parts: string[] = [];
  if (input.resume?.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText?.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(Minimal profile provided.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildPortfolioPrompt(input: PortfolioInput): string {
  const sections: string[] = [];

  sections.push(
    `Generate a complete, standalone HTML portfolio page for a student. The page must be a single self-contained HTML file with all CSS inline in a <style> tag in the <head>. No external stylesheets, no JavaScript, no external fonts — it must work when opened as a local file in any browser.`
  );

  sections.push(
    `Design:
- Dark navy header (#1a2332) with white text for the hero section
- White body (#ffffff) with dark text (#1a1a1a)
- Accent color (#4a8fd4) for section dividers, skill tags, and links
- System font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- Clean typography: 16px base, 1.6 line-height, generous whitespace
- Responsive: looks good on both desktop and mobile (use CSS media queries)
- Professional and modern. No clip-art, no emojis, no decorative images.`
  );

  sections.push(
    `Sections to include:
1. Hero — Student's name (infer from resume or use "[Your Name]") and a one-line tagline summarising who they are and what they do.
2. About Me — 2-3 paragraphs. If a target role is provided, angle this toward that role. Otherwise, write a general professional summary.
3. Key Experience — 3-4 accomplishment bullets reframed from the resume. Use the "accomplished X by doing Y, resulting in Z" format where possible. Do not invent experiences — only reframe what is in the resume.
4. Skills — A grid of skill tags pulled from the resume and profile. Group into 2-3 categories if enough skills exist (e.g., Technical, Analytical, Communication).
5. What I'm Looking For — 1-2 sentences about the student's goals or target role. Only include this section if a target role is provided.
6. Contact — A placeholder section: "Get in touch: [your.email@example.com] · [LinkedIn] · [GitHub]". The student fills in real details after saving.

If a target role is provided, frame the entire page toward that role — the tagline, about me, and experience highlights should all position the student as a strong fit.`
  );

  if (input.jobTitle?.trim()) {
    sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  }
  if (input.jobAdvert?.trim()) {
    sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
  }

  sections.push(buildProfileSection(input));

  sections.push('Respond with ONLY the complete HTML document. No markdown, no code fences, no explanation. Start with <!DOCTYPE html>.');

  return sections.join('\n\n');
}
```

- [ ] **Step 4:** Run `npx vitest run lib/prompts/portfolio.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/portfolio.ts lib/prompts/portfolio.test.ts
git commit -m "feat(portfolio): add buildPortfolioPrompt"
```

---

## Task 3: API route

**Files:**
- Create: `app/api/portfolio/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildPortfolioPrompt, type PortfolioInput } from '@/lib/prompts/portfolio';
import { isTokenLimitError } from '@/lib/token-limit';

interface PortfolioRequest extends PortfolioInput {
  llmConfig?: LLMConfig;
}

const SYSTEM =
  'You generate standalone HTML portfolio pages. Respond with ONLY HTML. No markdown, no code fences, no explanation.';

function ensureHtml(raw: string): string {
  const trimmed = raw.trim();
  // Strip markdown code fences if the LLM wrapped the HTML in them
  let html = trimmed;
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // Basic sanity check
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    return html;
  }
  // Wrap in minimal shell
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Portfolio</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as PortfolioRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.freeText && input.freeText.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({
          error: 'Portfolio needs a resume or About you to generate from.',
        }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;
    let current = input;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildPortfolioPrompt(current) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = { ...current, jobAdvert: current.jobAdvert?.slice(0, 4000) };
      try {
        raw = await provider.createCompletion(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildPortfolioPrompt(current) },
          ],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        current = { ...current, resume: current.resume?.slice(0, 4000) };
        try {
          raw = await provider.createCompletion(
            [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: buildPortfolioPrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({
              error: 'Profile too long for a portfolio page. Try trimming your resume.',
            }),
            { status: 500 }
          );
        }
      }
    }

    const html = ensureHtml(raw!);
    const target =
      input.jobTitle?.trim() ||
      input.jobAdvert?.trim().split('\n')[0].slice(0, 60) ||
      null;

    return new Response(
      JSON.stringify({ html, target, trimmed }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[portfolio] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit` — expect clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/portfolio/route.ts
git commit -m "feat(api): add /api/portfolio with HTML validation and trim-retry"
```

---

## Task 4: Input card + preview + page

**Files:**
- Create: `components/portfolio/PortfolioInputCard.tsx`
- Create: `components/portfolio/PortfolioPreview.tsx`
- Create: `app/portfolio/page.tsx`

- [ ] **Step 1: Create PortfolioInputCard**

Follows the same pattern as `GapAnalysisInputCard` — read it for reference. All fields visible, pre-filled from store, no back link.

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type Portfolio } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function PortfolioInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState(false);

  const hasProfile = !!store.resumeText || !!store.freeText.trim();
  const canRun = hasProfile;

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
      const res = await fetch('/api/portfolio', {
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
        throw new Error(err.error || 'Could not generate the portfolio page.');
      }
      const { html, target, trimmed } = await res.json();
      store.setPortfolio({ html, target });
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Could not generate the portfolio page. Try again.'
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='border border-border rounded-lg bg-paper p-6'>
        <div className='editorial-rule justify-center mb-2'>
          <span>Portfolio page</span>
        </div>
        <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
          Generate a personal portfolio website
        </h2>
        <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
          The more profile detail you provide, the richer the page. Add a target role to tailor it for a specific career.
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
              Job title (optional)
            </label>
            <Input
              value={store.jobTitle}
              onChange={(e) => store.setJobTitle(e.target.value)}
              placeholder='e.g. Data analyst — tailors the page for this role'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert (optional)
            </label>
            <Textarea
              value={store.jobAdvert}
              rows={3}
              onChange={(e) => store.setJobAdvert(e.target.value)}
              placeholder='Paste a job listing for more specific tailoring.'
              disabled={running}
            />
          </div>

          <div className='flex justify-center pt-2'>
            <Button onClick={handleRun} disabled={!canRun || running}>
              {running ? (
                <><LoadingDots color='white' /> Generating…</>
              ) : (
                <><Globe className='w-4 h-4 mr-2' /> Generate portfolio page</>
              )}
            </Button>
          </div>

          {!canRun && (
            <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
              Upload a resume or write something in About you to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PortfolioPreview**

```tsx
'use client';

import type { Portfolio } from '@/lib/session-store';

type Props = {
  portfolio: Portfolio;
};

export default function PortfolioPreview({ portfolio }: Props) {
  return (
    <div>
      {portfolio.target && (
        <p className='text-[var(--text-sm)] text-ink-muted text-center mb-4'>
          Tailored for: {portfolio.target}
        </p>
      )}
      <iframe
        srcDoc={portfolio.html}
        sandbox='allow-same-origin'
        className='w-full border border-border rounded-lg bg-white'
        style={{ height: '70vh' }}
        title='Portfolio preview'
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the page orchestrator**

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingDots from '@/components/ui/loadingdots';
import PortfolioInputCard from '@/components/portfolio/PortfolioInputCard';
import PortfolioPreview from '@/components/portfolio/PortfolioPreview';
import { useSessionStore, type Portfolio } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function PortfolioPage() {
  const router = useRouter();
  const store = useSessionStore();
  const portfolio = store.portfolio;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  // Mount-only auto-run
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasProfile = !!(state.resumeText || state.freeText?.trim());
    if (!hasProfile || state.portfolio) return;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: state.resumeText ?? undefined,
            freeText: state.freeText || undefined,
            jobTitle: state.jobTitle || undefined,
            jobAdvert: state.jobAdvert || undefined,
            distilledProfile: state.distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Could not generate the portfolio page.');
        }
        const { html, target, trimmed } = await res.json();
        useSessionStore.getState().setPortfolio({ html, target });
        if (trimmed) {
          toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
        }
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : 'Could not generate the portfolio page.'
        );
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStartOver() {
    if (!confirm('Start over? This clears your results but keeps your uploaded material.')) return;
    store.resetOutputs();
    router.push('/');
  }

  function handleGenerateAnother() {
    store.setPortfolio(null);
  }

  function handleSave() {
    if (!portfolio) return;
    try {
      const blob = new Blob([portfolio.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = portfolio.target
        ? portfolio.target.replace(/\s+/g, '-').toLowerCase()
        : 'personal';
      a.download = `portfolio-${slug}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Portfolio saved as HTML');
    } catch (err) {
      console.error(err);
      toast.error('Could not save the file.');
    }
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {portfolio && (
              <>
                <Button variant='outline' onClick={handleSave}>
                  <Globe className='w-4 h-4 mr-2' />
                  Save as HTML
                </Button>
                <Button variant='outline' onClick={handleGenerateAnother}>
                  Generate another
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Generating your portfolio page…</p>
          </div>
        )}

        {!loading && !portfolio && <PortfolioInputCard />}

        {!loading && portfolio && (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Portfolio preview</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-6'>
              Your portfolio page
            </h1>
            <PortfolioPreview portfolio={portfolio} />
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 4:** Run `npx tsc --noEmit` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add components/portfolio/ app/portfolio/
git commit -m "feat(portfolio): add input card, iframe preview, and /portfolio page"
```

---

## Task 5: Landing + career card + session banner integrations

**Files:**
- Modify: `components/landing/ActionCards.tsx`
- Modify: `components/landing/SessionBanner.tsx`
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Add Portfolio card to ActionCards Materials pillar**

Read `components/landing/ActionCards.tsx`. Add `Globe` to the lucide import. Add a fourth card to the `materials` array:

```ts
    {
      icon: <Globe className='w-5 h-5' />,
      title: 'Portfolio page',
      description: 'Generate a personal portfolio website.',
      hover: 'Needs a resume or About you. Add a target role to tailor it.',
      path: '/portfolio',
    },
```

- [ ] **Step 2: Add portfolio link to SessionBanner**

Read `components/landing/SessionBanner.tsx`. Add `portfolio` to the store destructure. Add detection:

```ts
  const hasPortfolio = !!portfolio;
```

Add to `hasAnyOutput`. Add the link after the resume review link:

```tsx
  {hasPortfolio && (
    <Link href='/portfolio' className='underline hover:text-accent'>
      portfolio ready{portfolio!.target ? ` (${portfolio!.target})` : ''}
    </Link>
  )}
```

- [ ] **Step 3: Add portfolio entry to CareerNode dropdown**

Read `components/CareerNode.tsx`. Add `Globe` to the lucide import (add to existing import line). Add handler:

```ts
  function handleBuildPortfolio() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    useSessionStore.getState().setPortfolio(null);
    router.push('/portfolio');
  }
```

Add a dropdown item in the Materials group, after the cover letter item:

```tsx
  <DropdownMenuItem onClick={handleBuildPortfolio}>
    <Globe className='w-4 h-4 mr-2' /> Build a portfolio for this role
  </DropdownMenuItem>
```

- [ ] **Step 4:** Run `npx tsc --noEmit && npx vitest run` — expect clean and all tests green.

- [ ] **Step 5: Commit**

```bash
git add components/landing/ActionCards.tsx components/landing/SessionBanner.tsx components/CareerNode.tsx
git commit -m "feat(portfolio): add landing card, session banner link, and career card dropdown entry"
```

---

## Task 6: Manual QA

**Files:** none (verification only)

- [ ] **Step 1:** Run `npx vitest run` — all tests green.

- [ ] **Step 2:** Run `npm run electron:dev`

- [ ] **Step 3: Walk the QA checklist**

- [ ] Materials pillar shows 4 cards: Elevator pitch, Cover letter, Resume review, Portfolio page
- [ ] Click Portfolio page with no inputs → input card with resume + about you + job title + job advert
- [ ] Upload resume → Run → loading → iframe preview renders generated HTML
- [ ] Preview looks professional: dark navy header, white body, accent color, responsive
- [ ] Preview has sections: Hero, About Me, Key Experience, Skills, Contact
- [ ] Without target role → no "What I'm Looking For" section
- [ ] With target role → "What I'm Looking For" section present, page angled toward role
- [ ] Save as HTML → downloads `.html` file
- [ ] Open saved file in browser → renders same content, no broken references
- [ ] Generate another → returns to input card
- [ ] Career card dropdown → "Build a portfolio for this role" → `/portfolio` with target pre-filled
- [ ] Auto-run: arrive with resume loaded → portfolio generates on mount
- [ ] SessionBanner shows "portfolio ready" or "portfolio ready (Data analyst)"
- [ ] Start over → portfolio cleared
- [ ] No "Copy as Markdown" button on this page (deliberate)
- [ ] Iframe is sandboxed (inspect: `sandbox="allow-same-origin"`)
- [ ] Electron dev build end to end

- [ ] **Step 4:** Fix any QA findings.

---

## Notes for the implementer

- **No parser.** The LLM returns HTML directly, not JSON. The `ensureHtml` function in the API route does a sanity check and wraps non-HTML responses in a minimal shell. This is the only route in the app that doesn't use a JSON parser.
- **`srcdoc` attribute** on the iframe is the cleanest way to render inline HTML. No temp files, no blob URLs for the preview. The blob URL pattern is only used for the file download.
- **`sandbox="allow-same-origin"`** is necessary for the `srcdoc` content to render CSS correctly. Do NOT add `allow-scripts` — the generated HTML should be static.
- **No markdown export.** The deliverable IS the HTML file. "Copy as Markdown" doesn't make sense for a web page.
- **The auto-run uses the mount-only `[]` dependency pattern** (fixed in the earlier auto-run bug fix). Store reads inside the effect use `useSessionStore.getState()`.
- **Studio Calm tokens** for the app UI. The generated HTML has its OWN styling (navy/white/accent) that's independent of the app's theme — it's a standalone page the student takes with them.
- **`Globe` icon from Lucide** for the portfolio action. If `Globe` is not available, `Layout` or `FileCode` are alternatives.
