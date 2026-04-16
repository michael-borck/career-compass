'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import BoardInputCard from '@/components/board/BoardInputCard';
import BoardVoices from '@/components/board/BoardVoices';
import BoardSynthesisPanel from '@/components/board/BoardSynthesisPanel';
import { useSessionStore } from '@/lib/session-store';
import { boardReviewToMarkdown } from '@/lib/markdown-export';

export default function BoardPage() {
  const router = useRouter();
  const store = useSessionStore();
  const { boardReview } = store;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleRunAgain() {
    if (!boardReview) return;
    if (
      !confirm(
        'Run the board again? The current review will be cleared. Your framing and focus will be kept.'
      )
    ) {
      return;
    }
    store.setBoardPrefill({
      framing: boardReview.framing,
      focusRole: boardReview.focusRole ?? undefined,
    });
    store.setBoardReview(null);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-3xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {boardReview && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => boardReviewToMarkdown(boardReview)}
                  label='Copy as Markdown'
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

        {!boardReview ? (
          <BoardInputCard />
        ) : (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Board review</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
              Four perspectives on your profile
            </h1>

            {(boardReview.framing.trim() || boardReview.focusRole) && (
              <div className='text-center text-[var(--text-sm)] text-ink-muted mb-8 space-y-1'>
                {boardReview.framing.trim() && (
                  <div>
                    <span className='text-ink-quiet'>Your framing:</span> {boardReview.framing}
                  </div>
                )}
                {boardReview.focusRole && (
                  <div>
                    <span className='text-ink-quiet'>Focus role:</span> {boardReview.focusRole}
                  </div>
                )}
              </div>
            )}

            <BoardVoices voices={boardReview.voices} />
            <BoardSynthesisPanel synthesis={boardReview.synthesis} />

            <p className='text-[var(--text-xs)] text-ink-quiet text-center mt-6'>
              Ready to see the bigger picture?{' '}
              <Link href='/career-story' className='underline hover:text-accent'>
                Build your career story
              </Link>
            </p>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
