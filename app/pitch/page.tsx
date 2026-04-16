'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import { useSessionStore, type ElevatorPitch } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { pitchToMarkdown } from '@/lib/markdown-export';
import LoadingDots from '@/components/ui/loadingdots';
import PitchResultView from '@/components/pitch/PitchResultView';
import PitchInputCard from '@/components/pitch/PitchInputCard';

export default function PitchPage() {
  const router = useRouter();
  const store = useSessionStore();
  const pitch = store.elevatorPitch;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasAny =
    !!store.resumeText ||
    !!store.freeText.trim() ||
    !!store.jobTitle.trim() ||
    !!store.jobAdvert.trim() ||
    !!store.distilledProfile;
  const canAutoRun = hasAny && !pitch && !loading;

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
        const res = await fetch('/api/pitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: store.resumeText ?? undefined,
            freeText: store.freeText || undefined,
            jobTitle: store.jobTitle || undefined,
            jobAdvert: store.jobAdvert || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Pitch generation failed');
        }
        const { pitch: result, trimmed } = (await res.json()) as {
          pitch: ElevatorPitch;
          trimmed?: boolean;
        };
        store.setElevatorPitch(result);
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Pitch generation failed');
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

  function handleWriteAnother() {
    if (!pitch) return;
    if (!confirm('Write another? The current pitch will be cleared.')) return;
    store.setElevatorPitch(null);
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
            {pitch && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => pitchToMarkdown(pitch)}
                  label='Copy as Markdown'
                />
                <Button variant='outline' onClick={handleWriteAnother}>
                  Write another
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
            <p className='text-ink-muted'>Writing your elevator pitch…</p>
          </div>
        )}
        {!loading && !pitch && <PitchInputCard />}
        {!loading && pitch && <PitchResultView pitch={pitch} />}
      </div>
      <Toaster />
    </div>
  );
}
