'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore } from '@/lib/session-store';
import { industryExplorationToMarkdown } from '@/lib/markdown-export';
import { industryExplorationToDocx } from '@/components/industry/industry-docx';
import IndustryInputCard from '@/components/industry/IndustryInputCard';
import IndustryResultView from '@/components/industry/IndustryResultView';

export default function IndustryPage() {
  const router = useRouter();
  const store = useSessionStore();
  const exploration = useSessionStore((s) => s.industryExploration);

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleExploreAnother() {
    store.setIndustryExploration(null);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-4xl'>
        <Toaster position='bottom-center' />

        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {exploration && (
              <>
                <SaveDocxButton
                  getBlob={() => industryExplorationToDocx(exploration)}
                  filename={`industry-${exploration.industry.replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => industryExplorationToMarkdown(exploration)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleExploreAnother}>
                  Explore another
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {!exploration && <IndustryInputCard />}
        {exploration && <IndustryResultView exploration={exploration} />}
      </div>
    </div>
  );
}
