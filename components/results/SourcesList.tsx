'use client';

import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '@/lib/session-store';

type Props = {
  sources: SourceRef[];
  compact?: boolean;
  heading?: string;
};

export default function SourcesList({
  sources,
  compact = false,
  heading = 'Sources',
}: Props) {
  if (sources.length === 0) return null;

  if (compact) {
    return (
      <div className='mt-2 pl-4 border-l-2 border-border'>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Sources
        </div>
        <ol className='text-[var(--text-sm)] space-y-0.5'>
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className='flex items-start gap-2'>
              <span className='text-ink-quiet flex-shrink-0'>{i + 1}.</span>
              <a
                href={s.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-ink-muted hover:text-accent underline decoration-dotted inline-flex items-center gap-1 min-w-0'
              >
                <span className='truncate'>{s.title}</span>
                <ExternalLink className='w-3 h-3 flex-shrink-0' />
              </a>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className='border-t border-border pt-6 mt-6'>
      <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-3'>
        {heading}
      </h2>
      <ol className='space-y-2'>
        {sources.map((s, i) => (
          <li
            key={`${s.url}-${i}`}
            id={`source-${i + 1}`}
            className='flex items-start gap-3'
          >
            <span className='text-ink-quiet font-medium min-w-[1.5rem]'>
              {i + 1}.
            </span>
            <div className='flex-1 min-w-0'>
              <a
                href={s.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-ink hover:text-accent underline decoration-dotted inline-flex items-center gap-1.5'
              >
                <span>{s.title}</span>
                <ExternalLink className='w-3.5 h-3.5 flex-shrink-0' />
              </a>
              <div className='text-[var(--text-xs)] text-ink-quiet mt-0.5'>
                {s.domain}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
