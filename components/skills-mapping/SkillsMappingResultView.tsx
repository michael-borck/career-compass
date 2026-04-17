'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SkillsMapping, SkillFrameworkMapping, FrameworkLevel } from '@/lib/session-store';

type Props = { mapping: SkillsMapping };

function FrameworkBadge({ label, fw }: { label: string; fw: FrameworkLevel }) {
  if (!fw) return null;
  return (
    <div className='border border-border rounded px-3 py-2 bg-surface'>
      <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-0.5'>
        {label}
      </div>
      <div className='text-[var(--text-sm)] font-semibold text-ink'>{fw.name}</div>
      <div className='text-[var(--text-xs)] text-accent font-medium'>Level {fw.level}</div>
      {fw.description && (
        <div className='text-[var(--text-xs)] text-ink-muted mt-0.5'>{fw.description}</div>
      )}
    </div>
  );
}

function SkillCard({ m, expanded, onToggle }: { m: SkillFrameworkMapping; expanded: boolean; onToggle: () => void }) {
  const hasFrameworks = m.sfia || m.onet || m.esco || m.aqf;

  return (
    <div className='border border-border rounded-lg bg-paper overflow-hidden'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center justify-between p-4 text-left hover:bg-surface transition-colors'
      >
        <div className='flex-1 min-w-0'>
          <div className='text-[var(--text-base)] font-semibold text-ink'>{m.skill}</div>
          <div className='text-[var(--text-sm)] text-ink-muted mt-0.5'>
            &ldquo;{m.professionalPhrase}&rdquo;
          </div>
        </div>
        <div className='ml-3 text-ink-quiet'>
          {expanded ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
        </div>
      </button>

      {expanded && (
        <div className='px-4 pb-4 space-y-3'>
          {hasFrameworks && (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
              <FrameworkBadge label='SFIA (AU/UK Digital)' fw={m.sfia} />
              <FrameworkBadge label='O*NET (US Broad)' fw={m.onet} />
              <FrameworkBadge label='ESCO (European)' fw={m.esco} />
              <FrameworkBadge label='AQF (AU Qualifications)' fw={m.aqf} />
            </div>
          )}

          {m.nextLevel && (
            <div className='border-t border-border pt-3'>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                To level up
              </div>
              <p className='text-[var(--text-sm)] text-ink-muted'>{m.nextLevel}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SkillsMappingResultView({ mapping }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (mapping.mappings.length > 0) initial[0] = true;
    return initial;
  });

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  const allExpanded = mapping.mappings.every((_, i) => expanded[i]);

  function showAll() {
    const all: Record<number, boolean> = {};
    mapping.mappings.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule'>
          <span>Skills Mapping</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          Your skills in professional language
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{mapping.summary}</p>
      </div>

      {mapping.frameworkNotes && (
        <div className='border border-accent/30 bg-accent-soft rounded-lg px-4 py-3'>
          <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            About these frameworks
          </div>
          <p className='text-[var(--text-sm)] text-ink'>{mapping.frameworkNotes}</p>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>
            Skills ({mapping.mappings.length})
          </h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        <div className='space-y-2'>
          {mapping.mappings.map((m, i) => (
            <SkillCard key={i} m={m} expanded={!!expanded[i]} onToggle={() => toggle(i)} />
          ))}
        </div>
      </div>

      <div className='flex flex-wrap justify-end gap-3'>
        <Button variant='outline' onClick={() => router.push('/gap-analysis')}>
          Run gap analysis →
        </Button>
        <Button variant='outline' onClick={() => router.push('/learning-path')}>
          Build a learning path →
        </Button>
      </div>

      <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
        These mappings are approximate — based on AI interpretation, not certified assessment.{' '}
        <Link href='/career-story' className='underline hover:text-accent'>
          Build your career story
        </Link>
      </p>
    </div>
  );
}
