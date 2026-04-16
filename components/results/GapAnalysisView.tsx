'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GapAnalysis, SourceRef } from '@/lib/session-store';
import { useSessionStore } from '@/lib/session-store';
import { Button } from '@/components/ui/button';
import GapItem from './GapItem';
import SourcesList from './SourcesList';
import InlineCitation from './InlineCitation';
import { segmentCitations, hasAnyCitations } from '@/lib/citation-detect';

type Props = { analysis: GapAnalysis };

function renderWithCitations(text: string, sources: SourceRef[]) {
  const segments = segmentCitations(text);
  return segments.map((seg, i) => {
    if (seg.kind === 'text') return <span key={i}>{seg.value}</span>;
    return <InlineCitation key={i} index={seg.index} sources={sources} />;
  });
}

export default function GapAnalysisView({ analysis }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const sources = useSessionStore((s) => s.gapAnalysisSources) ?? [];
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

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

  function handlePracticeInterview() {
    router.push('/interview');
  }

  function handleChainToLearningPath() {
    store.setLearningPath(null);
    router.push('/learning-path');
  }

  return (
    <div className='space-y-8'>
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
        <p className='text-ink-muted leading-relaxed'>{renderWithCitations(analysis.summary, sources)}</p>
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
            <GapItem
              key={i}
              gap={g}
              expanded={!!expanded[i]}
              onToggle={() => toggle(i)}
              sources={sources}
            />
          ))}
        </div>
      </div>

      <div className='border-t border-border pt-6'>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Rough timeline
        </div>
        <p className='text-ink'>{renderWithCitations(analysis.realisticTimeline, sources)}</p>
        <p className='text-[var(--text-xs)] text-ink-quiet mt-1'>
          AI estimate. Verify against your own situation.
        </p>
      </div>

      {sources.length > 0 && (
        <div>
          {(() => {
            const hasMarkers =
              hasAnyCitations(analysis.summary) ||
              analysis.gaps.some(
                (g) => hasAnyCitations(g.why) || hasAnyCitations(g.targetLevel)
              ) ||
              hasAnyCitations(analysis.realisticTimeline);
            if (!hasMarkers) {
              return (
                <div className='mb-4 border border-accent/30 bg-accent-soft rounded-lg px-4 py-3 text-[var(--text-sm)] text-ink'>
                  The AI didn't tag specific claims with citation markers — the sources used for this analysis are listed below for your reference.
                </div>
              );
            }
            return null;
          })()}
          <SourcesList sources={sources} />
          <p className='text-[var(--text-xs)] text-ink-quiet italic mt-2'>
            AI-cited sources. Small or local models may occasionally misattribute a
            claim — click through to verify anything you plan to act on.
          </p>
        </div>
      )}

      <div className='flex flex-wrap justify-end gap-3'>
        <Button variant='outline' onClick={handlePracticeInterview}>
          Practice interview for this target →
        </Button>
        <Button onClick={handleChainToLearningPath}>
          Turn this into a learning path →
        </Button>
      </div>
    </div>
  );
}
