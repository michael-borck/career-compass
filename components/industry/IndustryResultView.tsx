'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { IndustryExploration } from '@/lib/session-store';

type Props = { exploration: IndustryExploration };

export default function IndustryResultView({ exploration }: Props) {
  const router = useRouter();

  return (
    <div className='space-y-8'>
      <div>
        <div className='editorial-rule'>
          <span>Industry Exploration</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          {exploration.industry}
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Overview</h2>
        {exploration.overview.split('\n\n').filter(Boolean).map((p, i) => (
          <p key={i} className='text-ink-muted leading-relaxed mb-3'>{p}</p>
        ))}
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-3'>Key roles</h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          {exploration.keyRoles.map((role, i) => (
            <div key={i} className='border border-border rounded-lg bg-paper p-4'>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-[var(--text-base)] font-semibold text-ink'>{role.title}</span>
                {role.entryLevel && (
                  <span className='text-[var(--text-xs)] bg-accent-soft text-accent px-2 py-0.5 rounded-full font-medium'>
                    Entry-level friendly
                  </span>
                )}
              </div>
              <p className='text-[var(--text-sm)] text-ink-muted'>{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {exploration.entryPoints.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>How to break in</h2>
          <ul className='space-y-1'>
            {exploration.entryPoints.map((ep, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium mt-0.5'>→</span>
                <span>{ep}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exploration.growthAreas.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>What&apos;s growing</h2>
          <ul className='space-y-1'>
            {exploration.growthAreas.map((g, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium mt-0.5'>↑</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exploration.dayInTheLife && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>A day in the life</h2>
          <p className='text-ink-muted leading-relaxed'>{exploration.dayInTheLife}</p>
        </div>
      )}

      {exploration.skillsInDemand.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Skills in demand</h2>
          <div className='flex flex-wrap gap-2'>
            {exploration.skillsInDemand.map((s, i) => (
              <span key={i} className='text-[var(--text-sm)] border border-border rounded-full px-3 py-1 text-ink-muted'>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {exploration.challenges.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Challenges to know about</h2>
          <ul className='space-y-1'>
            {exploration.challenges.map((c, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-ink-quiet font-medium mt-0.5'>•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className='flex flex-wrap justify-end gap-3'>
        <Button variant='outline' onClick={() => router.push('/gap-analysis')}>
          Run gap analysis →
        </Button>
        <Button variant='outline' onClick={() => router.push('/careers')}>
          Find careers in this space →
        </Button>
      </div>

      <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
        AI-generated overview. Verify specific claims before making decisions.{' '}
        <Link href='/career-story' className='underline hover:text-accent'>
          Build your career story
        </Link>
      </p>
    </div>
  );
}
