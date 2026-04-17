'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore, type CareerStory } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { careerStoryToMarkdown } from '@/lib/markdown-export';
import { careerStoryToDocx } from '@/components/career-story/career-story-docx';
import LoadingDots from '@/components/ui/loadingdots';
import CareerStoryResultView from '@/components/career-story/CareerStoryResultView';
import CareerStoryInputCard from '@/components/career-story/CareerStoryInputCard';

export default function CareerStoryPage() {
  const router = useRouter();
  const store = useSessionStore();
  const careerStory = store.careerStory;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasProfile =
    !!store.resumeText ||
    !!store.freeText.trim() ||
    !!store.distilledProfile;

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasInput =
      !!state.resumeText ||
      !!state.freeText?.trim() ||
      !!state.distilledProfile;
    if (!hasInput || state.careerStory) return;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/careerStory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: state.resumeText ?? undefined,
            freeText: state.freeText || undefined,
            jobTitle: state.jobTitle || undefined,
            jobAdvert: state.jobAdvert || undefined,
            distilledProfile: state.distilledProfile ?? undefined,
            careers: state.careers ?? undefined,
            gapAnalysis: state.gapAnalysis ?? undefined,
            learningPath: state.learningPath ?? undefined,
            boardReview: state.boardReview ?? undefined,
            odysseyLives: state.odysseyLives,
            comparison: state.comparison ?? undefined,
            elevatorPitch: state.elevatorPitch ?? undefined,
            coverLetter: state.coverLetter ?? undefined,
            resumeReview: state.resumeReview ?? undefined,
            interviewFeedback: state.interviewFeedback ?? undefined,
            valuesCompass: state.valuesCompass ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Career story generation failed');
        }
        const { story, trimmed } = (await res.json()) as {
          story: CareerStory;
          trimmed?: boolean;
        };
        useSessionStore.getState().setCareerStory(story);
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: '\u2139\uFE0F' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Career story generation failed');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleBuildAnother() {
    if (!careerStory) return;
    if (!confirm('Build another? The current story will be cleared.')) return;
    store.setCareerStory(null);
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
            {careerStory && (
              <>
                <SaveDocxButton
                  getBlob={() => careerStoryToDocx(careerStory)}
                  filename='my-career-story.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => careerStoryToMarkdown(careerStory)}
                  label='Copy as text'
                />
                <Button variant='outline' onClick={handleBuildAnother}>
                  Build another
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
            <p className='text-ink-muted'>Building your career story…</p>
          </div>
        )}
        {!loading && !careerStory && !hasProfile && <CareerStoryInputCard />}
        {!loading && !careerStory && hasProfile && (
          <CareerStoryInputCard />
        )}
        {!loading && careerStory && <CareerStoryResultView story={careerStory} />}
      </div>
      <Toaster />
    </div>
  );
}
