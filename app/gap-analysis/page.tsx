'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import { useSessionStore, type GapAnalysis } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import { gapAnalysisToMarkdown } from '@/lib/markdown-export';
import LoadingDots from '@/components/ui/loadingdots';
import GapAnalysisView from '@/components/results/GapAnalysisView';
import GapAnalysisInputCard from '@/components/gap-analysis/GapAnalysisInputCard';

export default function GapAnalysisPage() {
  const router = useRouter();
  const store = useSessionStore();
  const analysis = store.gapAnalysis;
  const sources = useSessionStore((s) => s.gapAnalysisSources) ?? [];
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  const hasProfile = !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;
  const canAutoRun = hasTarget && hasProfile && !analysis && !loading;

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
        const settings = await settingsStore.get();
        const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
        const res = await fetch('/api/gapAnalysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobAdvert: store.jobAdvert || undefined,
            jobTitle: store.jobTitle || undefined,
            resume: store.resumeText ?? undefined,
            aboutYou: store.freeText || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            grounded,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Gap analysis failed');
        }
        const { analysis: result, sources: srcList } = (await res.json()) as {
          analysis: GapAnalysis;
          sources?: any[];
        };
        store.setGapAnalysis(result);
        if (srcList) store.setGapAnalysisSources(srcList);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
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

  function handleRunAgain() {
    if (!analysis) return;
    if (!confirm('Run again? The current result will be cleared.')) return;
    store.setGapAnalysis(null);
    autoRanRef.current = false;
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-4xl'>
        {/* Top bar - always visible */}
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {analysis && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => gapAnalysisToMarkdown(analysis, sources)}
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

        {/* Content */}
        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Running gap analysis…</p>
          </div>
        )}
        {!loading && !analysis && <GapAnalysisInputCard />}
        {!loading && analysis && <GapAnalysisView analysis={analysis} />}
      </div>
      <Toaster />
    </div>
  );
}
