'use client';

import type { BoardSynthesis } from '@/lib/session-store';

type Props = {
  synthesis: BoardSynthesis;
};

export default function BoardSynthesisPanel({ synthesis }: Props) {
  return (
    <div className='mt-8'>
      <div className='editorial-rule justify-center mb-6'>
        <span>Where the board landed</span>
      </div>

      <div className='space-y-6'>
        {synthesis.agreements.length > 0 && (
          <div>
            <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>
              Where they agreed
            </h3>
            <ul className='space-y-1 text-ink-muted'>
              {synthesis.agreements.map((a, i) => (
                <li key={i} className='flex gap-2'>
                  <span className='text-accent flex-shrink-0'>·</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {synthesis.disagreements.length > 0 && (
          <div>
            <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>
              Where they pushed back on each other
            </h3>
            <ul className='space-y-1 text-ink-muted'>
              {synthesis.disagreements.map((d, i) => (
                <li key={i} className='flex gap-2'>
                  <span className='text-accent flex-shrink-0'>·</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {synthesis.topPriorities.length > 0 && (
          <div>
            <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>
              What to work on
            </h3>
            <ol className='space-y-1 text-ink-muted list-decimal list-inside'>
              {synthesis.topPriorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <p className='mt-8 text-[var(--text-xs)] text-ink-quiet italic text-center'>
        Four AI-generated perspectives. Disagreement is part of the exercise.
      </p>
    </div>
  );
}
