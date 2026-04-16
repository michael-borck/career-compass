'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useSessionStore, type GapAnalysis } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import LoadingDots from '@/components/ui/loadingdots';
import GapAnalysisView from '@/components/results/GapAnalysisView';
import GapAnalysisInputCard from '@/components/gap-analysis/GapAnalysisInputCard';

export default function GapAnalysisPage() {
  const router = useRouter();
  const store = useSessionStore();
  const analysis = store.gapAnalysis;
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
        const { analysis: result, sources } = (await res.json()) as {
          analysis: GapAnalysis;
          sources?: any[];
        };
        store.setGapAnalysis(result);
        if (sources) store.setGapAnalysisSources(sources);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoRun]);

  if (loading) {
    return (
      <div className='h-full flex flex-col items-center justify-center gap-4'>
        <LoadingDots style='big' color='gray' />
        <p className='text-ink-muted'>Running gap analysis…</p>
        <Toaster />
      </div>
    );
  }

  if (analysis) {
    return (
      <div className='h-full overflow-y-auto'>
        <GapAnalysisView analysis={analysis} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <GapAnalysisInputCard />
      <Toaster />
    </div>
  );
}
