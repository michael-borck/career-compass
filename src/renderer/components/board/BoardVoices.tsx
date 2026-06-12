'use client';

import type { BoardAdvisorRole, BoardAdvisorVoice } from '@/lib/session-store';

const TAGLINES: Record<BoardAdvisorRole, string> = {
  recruiter: 'Market-facing, keyword-scanning',
  hr: 'Culture and soft-signal reader',
  manager: 'Would they bet their team on you',
  mentor: 'Warm but honest coach',
};

type Props = {
  voices: BoardAdvisorVoice[];
};

export default function BoardVoices({ voices }: Props) {
  return (
    <div className='space-y-4'>
      {voices.map((v) => (
        <div
          key={v.role}
          className='border border-border border-l-4 border-l-accent/50 rounded-lg bg-paper p-5'
        >
          <h3 className='text-[var(--text-lg)] font-semibold text-ink'>{v.name}</h3>
          <p className='text-[var(--text-xs)] text-ink-quiet italic mb-3'>{TAGLINES[v.role]}</p>
          <p className='text-ink-muted leading-relaxed'>{v.response}</p>
        </div>
      ))}
    </div>
  );
}
