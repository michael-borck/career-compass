'use client';

import type { CoverLetter } from '@/lib/session-store';

type Props = { letter: CoverLetter };

export default function CoverLetterResultView({ letter }: Props) {
  const bodyParagraphs = letter.body.split('\n\n').filter(Boolean);

  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule justify-center'>
          <span>Cover Letter</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center'>
          {letter.target}
        </h1>
      </div>

      <div className='border border-border rounded-lg bg-paper-warm p-6 space-y-4'>
        <p className='text-ink leading-relaxed'>{letter.greeting}</p>
        {bodyParagraphs.map((para, i) => (
          <p key={i} className='text-ink leading-relaxed'>
            {para}
          </p>
        ))}
        <p className='text-ink leading-relaxed'>{letter.closing}</p>
      </div>

      <p className='text-[var(--text-xs)] text-ink-quiet italic'>
        AI-generated draft. Edit before sending.
      </p>
    </div>
  );
}
