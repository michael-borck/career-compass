'use client';

import type { OdysseyLife } from '@/lib/session-store';

type Props = {
  life: OdysseyLife;
};

export default function OdysseyElaboration({ life }: Props) {
  if (!life.headline && !life.dayInTheLife) return null;
  return (
    <div className='mt-6 space-y-6 text-ink'>
      {life.headline && (
        <p className='text-[var(--text-lg)] font-semibold italic text-ink'>
          {life.headline}
        </p>
      )}

      {life.dayInTheLife && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>A day in 2030</h3>
          <p className='text-ink-muted leading-relaxed'>{life.dayInTheLife}</p>
        </div>
      )}

      {life.typicalWeek.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Typical week</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.typicalWeek.map((w, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {life.toolsAndSkills.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Tools &amp; skills</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.toolsAndSkills.map((t, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {life.whoYouWorkWith && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Who you work with</h3>
          <p className='text-ink-muted leading-relaxed'>{life.whoYouWorkWith}</p>
        </div>
      )}

      {life.challenges.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Challenges</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.challenges.map((c, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {life.questionsToExplore.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Questions to explore</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.questionsToExplore.map((q, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
