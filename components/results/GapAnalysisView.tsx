'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { GapAnalysis, LearningPath } from '@/lib/session-store';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import { gapAnalysisToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig } from '@/lib/llm-client';
import CopyMarkdownButton from './CopyMarkdownButton';
import GapItem from './GapItem';

type Props = { analysis: GapAnalysis };

export default function GapAnalysisView({ analysis }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [chaining, setChaining] = useState(false);

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    analysis.gaps.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded = analysis.gaps.every((_, i) => expanded[i]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  function handlePracticeInterview() {
    router.push('/interview');
  }

  async function handleChainToLearningPath() {
    setChaining(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/learningPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          gapAnalysis: analysis,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Learning path failed');
      }
      const { path } = (await res.json()) as { path: LearningPath };
      store.setLearningPath(path);
      router.push('/learning-path');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate learning path');
    } finally {
      setChaining(false);
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-6 py-8 space-y-8'>
      <div className='flex items-center gap-3'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline'>
          ← Back
        </Link>
        <div className='flex-1' />
        <CopyMarkdownButton getMarkdown={() => gapAnalysisToMarkdown(analysis)} />
        <Button variant='outline' onClick={handleStartOver}>Start over</Button>
      </div>

      <div>
        <div className='editorial-rule'>
          <span>Gap Analysis</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          vs {analysis.target}
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{analysis.summary}</p>
      </div>

      {analysis.matches.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>What you already have</h2>
          <ul className='space-y-1'>
            {analysis.matches.map((m, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>✓</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>Gaps</h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Hide all details' : 'Show all details'}
          </button>
        </div>
        <div className='space-y-2'>
          {analysis.gaps.map((g, i) => (
            <GapItem key={i} gap={g} expanded={!!expanded[i]} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>

      <div className='border-t border-border pt-6'>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Rough timeline
        </div>
        <p className='text-ink'>{analysis.realisticTimeline}</p>
        <p className='text-[var(--text-xs)] text-ink-quiet mt-1'>
          AI estimate. Verify against your own situation.
        </p>
      </div>

      <div className='flex flex-wrap justify-end gap-3'>
        <Button variant='outline' onClick={handlePracticeInterview}>
          Practice interview for this target →
        </Button>
        <Button onClick={handleChainToLearningPath} disabled={chaining}>
          {chaining ? 'Building…' : 'Turn this into a learning path →'}
        </Button>
      </div>
    </div>
  );
}
