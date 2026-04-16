'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import { useSessionStore, type ResumeReview } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { resumeReviewToMarkdown } from '@/lib/markdown-export';
import LoadingDots from '@/components/ui/loadingdots';
import ResumeReviewResultView from '@/components/resume-review/ResumeReviewResultView';
import ResumeReviewInputCard from '@/components/resume-review/ResumeReviewInputCard';

export default function ResumeReviewPage() {
  const router = useRouter();
  const store = useSessionStore();
  const review = store.resumeReview;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasResume = !!store.resumeText;
  const canAutoRun = hasResume && !review && !loading;

  useEffect(() => {
    if (!canAutoRun || autoRanRef.current) return;
    autoRanRef.current = true;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/resumeReview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: store.resumeText ?? undefined,
            jobTitle: store.jobTitle || undefined,
            jobAdvert: store.jobAdvert || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Resume review failed');
        }
        const { review: result, trimmed } = (await res.json()) as {
          review: ResumeReview;
          trimmed?: boolean;
        };
        store.setResumeReview(result);
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Resume review failed');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoRun]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleReviewAgain() {
    if (!review) return;
    if (!confirm('Review again? The current feedback will be cleared.')) return;
    store.setResumeReview(null);
    autoRanRef.current = false;
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-4xl'>
        {/* Top bar */}
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {review && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => resumeReviewToMarkdown(review)}
                  label='Copy as Markdown'
                />
                <Button variant='outline' onClick={handleReviewAgain}>
                  Review again
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Reviewing your resume…</p>
          </div>
        )}
        {!loading && !review && <ResumeReviewInputCard />}
        {!loading && review && <ResumeReviewResultView review={review} />}
      </div>
      <Toaster />
    </div>
  );
}
