'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Gap } from '@/lib/session-store';

type Props = {
  gap: Gap;
  expanded: boolean;
  onToggle: () => void;
};

const SEVERITY_LABEL: Record<Gap['severity'], string> = {
  'critical': 'CRITICAL',
  'important': 'IMPORTANT',
  'nice-to-have': 'NICE-TO-HAVE',
};

const SEVERITY_COLOR: Record<Gap['severity'], string> = {
  'critical': 'text-error',
  'important': 'text-accent',
  'nice-to-have': 'text-ink-muted',
};

export default function GapItem({ gap, expanded, onToggle }: Props) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div className='border border-border rounded-lg bg-paper'>
      <button
        type='button'
        onClick={onToggle}
        className='w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent-soft transition-colors duration-[250ms]'
        aria-expanded={expanded}
      >
        <Chevron className='w-4 h-4 text-ink-quiet flex-shrink-0' />
        <span className={`text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] ${SEVERITY_COLOR[gap.severity]} flex-shrink-0`}>
          [{SEVERITY_LABEL[gap.severity]}]
        </span>
        <span className='text-ink font-medium flex-1'>{gap.title}</span>
      </button>
      {expanded && (
        <div className='border-t border-border px-4 py-4 space-y-3'>
          {gap.why && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Why it matters
              </div>
              <p className='text-ink-muted leading-relaxed'>{gap.why}</p>
            </div>
          )}
          {gap.targetLevel && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Target level
              </div>
              <p className='text-ink-muted leading-relaxed'>{gap.targetLevel}</p>
            </div>
          )}
          {gap.currentLevel && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Current level
              </div>
              <p className='text-ink-muted leading-relaxed'>{gap.currentLevel}</p>
            </div>
          )}
          {gap.evidenceIdeas.length > 0 && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                How to demonstrate
              </div>
              <ul className='list-disc ml-5 text-ink-muted leading-relaxed space-y-1'>
                {gap.evidenceIdeas.map((idea, i) => (
                  <li key={i}>{idea}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
