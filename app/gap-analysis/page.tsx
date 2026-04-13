'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import GapAnalysisView from '@/components/results/GapAnalysisView';

export default function GapAnalysisPage() {
  const analysis = useSessionStore((s) => s.gapAnalysis);

  if (!analysis) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4 p-10'>
        <p className='text-ink-muted'>No analysis yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <GapAnalysisView analysis={analysis} />
      <Toaster />
    </div>
  );
}
