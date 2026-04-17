'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import OdysseyLifeCard from '@/components/odyssey/OdysseyLifeCard';
import OdysseyCompareView from '@/components/odyssey/OdysseyCompareView';
import { useSessionStore, type OdysseyLifeType } from '@/lib/session-store';
import { odysseyPlanToMarkdown } from '@/lib/markdown-export';
import { odysseyPlanToDocx } from '@/components/odyssey/odyssey-docx';

const TYPES: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];

export default function OdysseyPage() {
  const router = useRouter();
  const store = useSessionStore();
  const { odysseyLives } = store;
  const [view, setView] = useState<'cards' | 'compare'>('cards');

  const elaboratedCount = TYPES.filter((t) => !!odysseyLives[t].headline).length;
  const canCompare = elaboratedCount >= 2;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  const markdown = odysseyPlanToMarkdown(odysseyLives);

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            <SaveDocxButton getBlob={() => odysseyPlanToDocx(odysseyLives)} filename='odyssey-plan.docx' />
            <CopyMarkdownButton getMarkdown={() => markdown} label='Copy as text' />
            {view === 'cards' ? (
              <Button
                variant='outline'
                onClick={() => setView('compare')}
                disabled={!canCompare}
                title={canCompare ? 'Compare all three lives' : 'Elaborate at least two lives first'}
              >
                <Columns3 className='w-4 h-4 mr-2' />
                Compare all three
              </Button>
            ) : (
              <Button variant='outline' onClick={() => setView('cards')}>
                <ArrowLeft className='w-4 h-4 mr-2' />
                Back to cards
              </Button>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        <div className='editorial-rule justify-center mb-2'>
          <span>Odyssey Plan</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
          Imagine three lives
        </h1>
        <p className='text-[var(--text-base)] text-ink-muted text-center max-w-2xl mx-auto mb-8'>
          Three alternative five-year futures. Brainstorm each seed, let the AI flesh it out,
          then rate how each one feels. There are no wrong answers.
        </p>

        {view === 'cards' ? (
          <div className='space-y-6'>
            {TYPES.map((type) => (
              <OdysseyLifeCard key={type} type={type} />
            ))}
          </div>
        ) : (
          <OdysseyCompareView lives={odysseyLives} />
        )}

        <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
          Ready to see the bigger picture?{' '}
          <Link href='/career-story' className='underline hover:text-accent'>
            Build your career story
          </Link>
        </p>
      </div>
      <Toaster />
    </div>
  );
}
