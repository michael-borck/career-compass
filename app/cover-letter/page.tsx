'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import { useSessionStore, type CoverLetter } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { coverLetterToMarkdown } from '@/lib/markdown-export';
import LoadingDots from '@/components/ui/loadingdots';
import CoverLetterResultView from '@/components/cover-letter/CoverLetterResultView';
import CoverLetterInputCard from '@/components/cover-letter/CoverLetterInputCard';
import { coverLetterToDocx } from '@/components/cover-letter/cover-letter-docx';

export default function CoverLetterPage() {
  const router = useRouter();
  const store = useSessionStore();
  const letter = store.coverLetter;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasT = !!(state.jobTitle?.trim() || state.jobAdvert?.trim());
    if (!hasT || state.coverLetter) return;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/coverLetter', {
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
          throw new Error(err.error || 'Cover letter generation failed');
        }
        const { letter: result, trimmed } = (await res.json()) as {
          letter: CoverLetter;
          trimmed?: boolean;
        };
        useSessionStore.getState().setCoverLetter(result);
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: 'ℹ️' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Cover letter generation failed');
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

  function handleDraftAnother() {
    if (!letter) return;
    if (!confirm('Draft another? The current letter will be cleared.')) return;
    store.setCoverLetter(null);
    autoRanRef.current = false;
  }

  async function handleSaveDocx() {
    if (!letter) return;
    try {
      const blob = await coverLetterToDocx(letter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cover-letter-${(letter.target || 'general').replace(/\s+/g, '-').toLowerCase()}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Cover letter saved as DOCX');
    } catch (err) {
      console.error(err);
      toast.error('Could not create the document. Copy as Markdown instead.');
    }
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
            {letter && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => coverLetterToMarkdown(letter)}
                  label='Copy as Markdown'
                />
                <Button variant='outline' onClick={handleSaveDocx}>
                  Save as DOCX
                </Button>
                <Button variant='outline' onClick={handleDraftAnother}>
                  Draft another
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
            <p className='text-ink-muted'>Drafting your cover letter…</p>
          </div>
        )}
        {!loading && !letter && <CoverLetterInputCard />}
        {!loading && letter && <CoverLetterResultView letter={letter} />}
      </div>
      <Toaster />
    </div>
  );
}
