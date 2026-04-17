'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { ValuesCompass } from '@/lib/session-store';

type Props = { compass: ValuesCompass };

export default function ValuesResultView({ compass }: Props) {
  const router = useRouter();

  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule'>
          <span>Values Compass</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          What drives you
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{compass.summary}</p>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-3'>Your values, ranked</h2>
        <div className='space-y-3'>
          {compass.values.map((v) => (
            <div key={v.rank} className='border border-border rounded-lg bg-paper p-4'>
              <div className='flex items-center gap-3 mb-2'>
                <span className='flex items-center justify-center w-7 h-7 rounded-full bg-accent-soft text-accent text-[var(--text-sm)] font-bold'>
                  {v.rank}
                </span>
                <span className='text-[var(--text-base)] font-semibold text-ink'>{v.name}</span>
              </div>
              <p className='text-[var(--text-sm)] text-ink-muted mb-2'>{v.description}</p>
              {v.evidence && (
                <p className='text-[var(--text-xs)] text-ink-quiet mb-2'>
                  <span className='font-medium'>Why we think this:</span> {v.evidence}
                </p>
              )}
              {v.reflectionQuestion && (
                <p className='text-[var(--text-sm)] text-ink italic border-l-2 border-accent/30 pl-3'>
                  {v.reflectionQuestion}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {compass.tensions.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Tensions to explore</h2>
          <p className='text-[var(--text-xs)] text-ink-quiet mb-3'>
            Values can pull in different directions. That&apos;s normal — the tension itself is worth understanding.
          </p>
          <ul className='space-y-2'>
            {compass.tensions.map((t, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium mt-0.5'>⟷</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className='flex flex-wrap justify-end gap-3'>
        <Button variant='outline' onClick={() => router.push('/odyssey')}>
          Imagine three lives →
        </Button>
        <Button variant='outline' onClick={() => router.push('/career-story')}>
          Build your career story →
        </Button>
      </div>

      <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
        AI-inferred values. Treat as a starting point for reflection, not a personality test.{' '}
        <Link href='/board' className='underline hover:text-accent'>
          Ask the board of advisors
        </Link>
      </p>
    </div>
  );
}
