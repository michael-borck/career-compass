'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingDots from '@/components/ui/loadingdots';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import CompareInputCard from '@/components/compare/CompareInputCard';
import CompareTable from '@/components/compare/CompareTable';
import { useSessionStore, type Comparison } from '@/lib/session-store';
import { comparisonToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';

export default function ComparePage() {
  const router = useRouter();
  const store = useSessionStore();
  const { comparison } = store;
  const [loading, setLoading] = useState(false);
  const { gatedPush, modalProps } = useGatedNavigate();
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const prefill = store.consumeComparePrefill();
    if (!prefill?.richCareerTitles || prefill.richCareerTitles.length < 2) {
      if (prefill?.seedTarget) {
        store.setComparePrefill({ seedTarget: prefill.seedTarget });
      }
      return;
    }

    const careers = store.careers ?? [];
    const resolved = prefill.richCareerTitles
      .map((title) => careers.find((c) => c.jobTitle === title))
      .filter((c): c is NonNullable<typeof c> => !!c);

    if (resolved.length !== prefill.richCareerTitles.length) {
      toast.error('The selected careers are no longer available. Generate careers again and retry.');
      return;
    }

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const targets = resolved.map((c) => ({ label: c.jobTitle, context: c }));
        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'rich',
            targets,
            resume: store.resumeText ?? undefined,
            freeText: store.freeText || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'The comparison could not be run.');
        }
        const { comparison: result } = (await res.json()) as { comparison: Comparison };
        store.setComparison(result);
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error
            ? err.message
            : 'The comparison came back garbled. Try again \u2014 a second attempt often works.'
        );
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

  function handleRunAnother() {
    if (!comparison) return;
    if (!confirm('Run another comparison? The current result will be cleared.')) return;
    if (comparison.roles.length > 0) {
      store.setComparePrefill({ seedTarget: comparison.roles[0].label });
    }
    store.setComparison(null);
  }

  function handleGapForRole(label: string) {
    store.setJobTitle(label);
    gatedPush('gaps', '/gap-analysis');
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {comparison && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => comparisonToMarkdown(comparison)}
                  label='Copy as Markdown'
                />
                <Button variant='outline' onClick={handleRunAnother}>
                  Run another
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Comparing careers...</p>
          </div>
        )}

        {!loading && !comparison && <CompareInputCard />}

        {!loading && comparison && (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Career comparison</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
              {comparison.roles.length} roles side-by-side
            </h1>

            {comparison.mode === 'quick' && (
              <div className='border-l-2 border-accent p-4 bg-paper-warm mt-4 mb-6'>
                <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
                  This is a quick compare. The LLM inferred each role&apos;s details. For a
                  richer comparison based on your generated careers, run{' '}
                  <strong>Find my careers</strong> from the landing page.
                </p>
              </div>
            )}

            <CompareTable comparison={comparison} />

            <div className='mt-8 pt-6 border-t border-border'>
              <div className='editorial-rule justify-center mb-4'>
                <span>Next steps</span>
              </div>
              <div className='flex flex-wrap justify-center gap-3'>
                {comparison.roles.map((role) => (
                  <Button
                    key={role.label}
                    variant='outline'
                    size='sm'
                    onClick={() => handleGapForRole(role.label)}
                  >
                    Analyse gaps for {role.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <MissingInputsModal {...modalProps} />
      <Toaster />
    </div>
  );
}
