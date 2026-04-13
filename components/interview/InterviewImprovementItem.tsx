'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { InterviewImprovement } from '@/lib/session-store';

type Props = {
  improvement: InterviewImprovement;
  index: number;
  expanded: boolean;
  onToggle: () => void;
};

export default function InterviewImprovementItem({
  improvement,
  index,
  expanded,
  onToggle,
}: Props) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const isTop = index === 0;

  return (
    <div className='border border-border rounded-lg bg-paper'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent-soft transition-colors duration-[250ms]'
        aria-expanded={expanded}
      >
        <Chevron className='w-4 h-4 text-ink-quiet flex-shrink-0' />
        {isTop && (
          <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-accent flex-shrink-0'>
            [TOP]
          </span>
        )}
        <span className='text-ink font-medium flex-1'>{improvement.area}</span>
      </button>
      {expanded && (
        <div className='border-t border-border px-4 py-4 space-y-3'>
          {improvement.why && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Why it matters
              </div>
              <p className='text-ink-muted leading-relaxed'>{improvement.why}</p>
            </div>
          )}
          {improvement.example && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Example reframe of your answer
              </div>
              <p className='text-ink-muted leading-relaxed italic border-l-2 border-accent/40 pl-3'>
                {improvement.example}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
