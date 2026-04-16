'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import type { LearningPath } from '@/lib/session-store';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import MilestoneItem from './MilestoneItem';
import SourcesList from './SourcesList';

type Props = { path: LearningPath };

export default function LearningPathView({ path }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const sources = useSessionStore((s) => s.learningPathSources) ?? [];
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

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

  function handlePracticeInterview() {
    router.push('/interview');
  }

  function handleChainToGapAnalysis() {
    store.setGapAnalysis(null);
    router.push('/gap-analysis');
  }

  return (
    <div className='space-y-8'>
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

      {sources.length > 0 && <SourcesList sources={sources} />}

      <div className='flex flex-wrap justify-end gap-3'>
        {hasProfile && (
          <Button variant='outline' onClick={handleChainToGapAnalysis}>
            Run gap analysis for this target →
          </Button>
        )}
        <Button variant='outline' onClick={handlePracticeInterview}>
          Practice interview for this target →
        </Button>
      </div>
    </div>
  );
}
