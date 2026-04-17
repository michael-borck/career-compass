'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore, type ElevatorPitch } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { pitchToMarkdown } from '@/lib/markdown-export';
import { pitchToDocx } from '@/components/pitch/pitch-docx';
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

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasInput =
      !!state.resumeText ||
      !!state.freeText?.trim() ||
      !!state.jobTitle?.trim() ||
      !!state.jobAdvert?.trim() ||
      !!state.distilledProfile;
    if (!hasInput || state.elevatorPitch) return;

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
            resume: state.resumeText ?? undefined,
            freeText: state.freeText || undefined,
            jobTitle: state.jobTitle || undefined,
            jobAdvert: state.jobAdvert || undefined,
            distilledProfile: state.distilledProfile ?? undefined,
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
        useSessionStore.getState().setElevatorPitch(result);
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Pitch generation failed');
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
                <SaveDocxButton
                  getBlob={() => pitchToDocx(pitch)}
                  filename={`elevator-pitch-${(pitch.target ?? 'general').replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => pitchToMarkdown(pitch)}
                  label='Copy as text'
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
