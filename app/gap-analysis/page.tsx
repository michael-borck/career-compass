'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore, type GapAnalysis } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import { gapAnalysisToMarkdown } from '@/lib/markdown-export';
import { gapAnalysisToDocx } from '@/components/gap-analysis/gap-analysis-docx';
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

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasT = !!(state.jobTitle?.trim() || state.jobAdvert?.trim());
    const hasP = !!(state.resumeText || state.freeText?.trim() || state.distilledProfile);
    if (!hasT || !hasP || state.gapAnalysis) return;

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
            jobAdvert: state.jobAdvert || undefined,
            jobTitle: state.jobTitle || undefined,
            resume: state.resumeText ?? undefined,
            aboutYou: state.freeText || undefined,
            distilledProfile: state.distilledProfile ?? undefined,
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
        useSessionStore.getState().setGapAnalysis(result);
        if (srcList) useSessionStore.getState().setGapAnalysisSources(srcList);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
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
                <SaveDocxButton
                  getBlob={() => gapAnalysisToDocx(analysis, sources)}
                  filename={`gap-analysis-${analysis.target.replace(/\s+/g, '-').toLowerCase()}.docx`}
                />
                <CopyMarkdownButton
                  getMarkdown={() => gapAnalysisToMarkdown(analysis, sources)}
                  label='Copy as text'
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
