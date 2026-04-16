'use client';

import type { ElevatorPitch } from '@/lib/session-store';

type Props = { pitch: ElevatorPitch };

export default function PitchResultView({ pitch }: Props) {
  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule justify-center'>
          <span>Elevator Pitch</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center'>
          {pitch.target ?? 'General'}
        </h1>
      </div>

      <div>
        <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Your hook</h3>
        <blockquote className='border-l-2 border-accent pl-4 text-ink-muted italic leading-relaxed'>
          {pitch.hook}
        </blockquote>
      </div>

      <div>
        <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>The pitch</h3>
        <p className='text-ink-muted leading-relaxed'>{pitch.body}</p>
      </div>

      <div>
        <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Your close</h3>
        <blockquote className='border-l-2 border-accent pl-4 text-ink-muted italic leading-relaxed'>
          {pitch.close}
        </blockquote>
      </div>

      <div>
        <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Full script</h3>
        <div className='border border-border rounded-lg bg-paper-warm p-5'>
          <p className='text-ink leading-relaxed'>{pitch.fullScript}</p>
        </div>
      </div>

      <p className='text-[var(--text-xs)] text-ink-quiet italic'>
        AI-generated pitch. Edit to match your voice before using.
      </p>
    </div>
  );
}
