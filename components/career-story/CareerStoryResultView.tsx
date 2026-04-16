'use client';

import type { CareerStory } from '@/lib/session-store';

type Props = { story: CareerStory };

export default function CareerStoryResultView({ story }: Props) {
  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule justify-center mb-2'>
          <span>Career story</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
          Your career story
        </h1>
      </div>

      <div className='prose max-w-none'>
        {story.narrative.split('\n\n').filter(Boolean).map((p, i) => (
          <p key={i} className='text-ink leading-relaxed mb-4'>{p}</p>
        ))}
      </div>

      <div className='editorial-rule justify-center my-8'>
        <span>Themes we found</span>
      </div>

      <div className='space-y-4'>
        {story.themes.map((theme, i) => (
          <div key={i} className='border border-border rounded-lg bg-paper p-5'>
            <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>{theme.name}</h3>
            {theme.evidence.length > 0 && (
              <ul className='space-y-1 text-ink-muted mb-3'>
                {theme.evidence.map((e, j) => (
                  <li key={j} className='flex gap-2'>
                    <span className='text-accent flex-shrink-0'>·</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
            {theme.reflectionQuestion && (
              <p className='text-ink-quiet italic text-[var(--text-sm)]'>{theme.reflectionQuestion}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
