'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useSessionStore, type LearningPath } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import LoadingDots from '@/components/ui/loadingdots';
import LearningPathView from '@/components/results/LearningPathView';
import LearningPathInputCard from '@/components/learning-path/LearningPathInputCard';

export default function LearningPathPage() {
  const router = useRouter();
  const store = useSessionStore();
  const path = store.learningPath;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
  const canAutoRun = hasTarget && !path && !loading;

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
        const res = await fetch('/api/learningPath', {
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
          throw new Error(err.error || 'Learning path failed');
        }
        const { path: result, sources } = (await res.json()) as {
          path: LearningPath;
          sources?: any[];
        };
        store.setLearningPath(result);
        if (sources) store.setLearningPathSources(sources);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Learning path failed');
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
        <p className='text-ink-muted'>Building learning path…</p>
        <Toaster />
      </div>
    );
  }

  if (path) {
    return (
      <div className='h-full overflow-y-auto'>
        <LearningPathView path={path} />
        <Toaster />
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto'>
      <LearningPathInputCard />
      <Toaster />
    </div>
  );
}
