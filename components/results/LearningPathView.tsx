'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import type { LearningPath, GapAnalysis } from '@/lib/session-store';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import { learningPathToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig } from '@/lib/llm-client';
import CopyMarkdownButton from './CopyMarkdownButton';
import MilestoneItem from './MilestoneItem';

type Props = { path: LearningPath };

export default function LearningPathView({ path }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [chaining, setChaining] = useState(false);

  const hasProfile = !!(store.resumeText || store.freeText.trim() || store.distilledProfile);

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    path.milestones.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded = path.milestones.every((_, i) => expanded[i]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  function handlePracticeInterview() {
    router.push('/interview');
  }

  async function handleChainToGapAnalysis() {
    setChaining(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/gapAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: store.jobAdvert || undefined,
          jobTitle: store.jobTitle || undefined,
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gap analysis failed');
      }
      const { analysis } = (await res.json()) as { analysis: GapAnalysis };
      store.setGapAnalysis(analysis);
      router.push('/gap-analysis');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to run gap analysis');
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
        <CopyMarkdownButton getMarkdown={() => learningPathToMarkdown(path)} />
        <Button variant='outline' onClick={handleStartOver}>Start over</Button>
      </div>

      <div>
        <div className='editorial-rule'>
          <span>Learning Path</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          to {path.target}
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{path.summary}</p>
      </div>

      <div>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Total duration
        </div>
        <p className='text-ink mb-3'>{path.totalDuration}</p>
        {path.caveats.length > 0 && (
          <div>
            <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Caveats
            </div>
            <ul className='list-disc ml-5 text-ink-muted text-[var(--text-sm)] space-y-1'>
              {path.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {path.prerequisites.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Before you start</h2>
          <ul className='space-y-1'>
            {path.prerequisites.map((p, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>Milestones</h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Hide all details' : 'Show all details'}
          </button>
        </div>
        <div className='space-y-2'>
          {path.milestones.map((m, i) => (
            <MilestoneItem key={i} milestone={m} expanded={!!expanded[i]} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>

      {path.portfolioProject && (
        <div className='border border-accent/30 bg-accent-soft rounded-lg p-5'>
          <div className='flex items-center gap-2 mb-2'>
            <FolderOpen className='w-4 h-4 text-accent' />
            <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet'>
              Portfolio project
            </span>
          </div>
          <p className='text-ink leading-relaxed'>{path.portfolioProject}</p>
        </div>
      )}

      <div className='flex flex-wrap justify-end gap-3'>
        {hasProfile && (
          <Button variant='outline' onClick={handleChainToGapAnalysis} disabled={chaining}>
            {chaining ? 'Analysing…' : 'Run gap analysis for this target →'}
          </Button>
        )}
        <Button variant='outline' onClick={handlePracticeInterview}>
          Practice interview for this target →
        </Button>
      </div>
    </div>
  );
}
