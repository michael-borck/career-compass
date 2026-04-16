'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ResumeReview, ResumeReviewItem } from '@/lib/session-store';

type Props = { review: ResumeReview };

function ImprovementCard({
  item,
  expanded,
  onToggle,
}: {
  item: ResumeReviewItem;
  expanded: boolean;
  onToggle: () => void;
}) {
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
        <span className='text-ink font-medium flex-1'>{item.section}</span>
        <span className='text-ink-muted text-[var(--text-sm)] flex-shrink-0 max-w-[50%] truncate'>
          {item.suggestion}
        </span>
      </button>
      {expanded && (
        <div className='border-t border-border px-4 py-4 space-y-3'>
          <div>
            <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Suggestion
            </div>
            <p className='text-ink-muted leading-relaxed'>{item.suggestion}</p>
          </div>
          {item.why && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Why it matters
              </div>
              <p className='text-ink-muted leading-relaxed'>{item.why}</p>
            </div>
          )}
          {item.example && (
            <div>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Example
              </div>
              <p className='text-ink-muted leading-relaxed italic'>
                &ldquo;{item.example}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResumeReviewResultView({ review }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    review.improvements.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded =
    review.improvements.length > 0 &&
    review.improvements.every((_, i) => expanded[i]);

  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule justify-center'>
          <span>Resume Review</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center'>
          {review.target ?? 'General review'}
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>
          Overall impression
        </h2>
        <p className='text-ink-muted leading-relaxed'>{review.overallImpression}</p>
      </div>

      {review.strengths.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>
            What&apos;s working
          </h2>
          <ul className='space-y-1'>
            {review.strengths.map((s, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>&#10003;</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.improvements.length > 0 && (
        <div>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='text-[var(--text-lg)] font-semibold text-ink'>
              Suggested improvements
            </h2>
            <button
              type='button'
              onClick={allExpanded ? hideAll : showAll}
              className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
            >
              {allExpanded ? 'Hide all details' : 'Show all details'}
            </button>
          </div>
          <div className='space-y-2'>
            {review.improvements.map((item, i) => (
              <ImprovementCard
                key={i}
                item={item}
                expanded={!!expanded[i]}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>
        </div>
      )}

      {review.keywordsToAdd.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>
            Keywords to add
          </h2>
          <ul className='space-y-1'>
            {review.keywordsToAdd.map((k, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>+</span>
                <span>{k}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.structuralNotes.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>
            Structural notes
          </h2>
          <ul className='space-y-1'>
            {review.structuralNotes.map((n, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-ink-quiet'>&bull;</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className='text-[var(--text-xs)] text-ink-quiet italic'>
        AI-generated feedback. Use as a starting point, not a final verdict.
      </p>
    </div>
  );
}
