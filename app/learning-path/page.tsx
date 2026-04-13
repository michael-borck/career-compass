'use client';

import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import LearningPathView from '@/components/results/LearningPathView';

export default function LearningPathPage() {
  const path = useSessionStore((s) => s.learningPath);

  if (!path) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4 p-10'>
        <p className='text-ink-muted'>No learning path yet.</p>
        <Link href='/' className='underline'>Back to start</Link>
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <LearningPathView path={path} />
      <Toaster />
    </div>
  );
}
