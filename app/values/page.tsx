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
import { valuesCompassToMarkdown } from '@/lib/markdown-export';
import { valuesCompassToDocx } from '@/components/values/values-docx';
import ValuesInputCard from '@/components/values/ValuesInputCard';
import ValuesResultView from '@/components/values/ValuesResultView';

export default function ValuesPage() {
  const router = useRouter();
  const store = useSessionStore();
  const compass = useSessionStore((s) => s.valuesCompass);

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleRunAgain() {
    store.setValuesCompass(null);
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
            {compass && (
              <>
                <SaveDocxButton
                  getBlob={() => valuesCompassToDocx(compass)}
                  filename='values-compass.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => valuesCompassToMarkdown(compass)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleRunAgain}>
                  Run again
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {!compass && <ValuesInputCard />}
        {compass && <ValuesResultView compass={compass} />}
      </div>
    </div>
  );
}
