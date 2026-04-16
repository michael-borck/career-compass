'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import { useSessionStore, type LearningPath } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import { learningPathToMarkdown } from '@/lib/markdown-export';
import LoadingDots from '@/components/ui/loadingdots';
import LearningPathView from '@/components/results/LearningPathView';
import LearningPathInputCard from '@/components/learning-path/LearningPathInputCard';

export default function LearningPathPage() {
  const router = useRouter();
  const store = useSessionStore();
  const path = store.learningPath;
  const sources = useSessionStore((s) => s.learningPathSources) ?? [];
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasT = !!(state.jobTitle?.trim() || state.jobAdvert?.trim());
    if (!hasT || state.learningPath) return;

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
          throw new Error(err.error || 'Learning path failed');
        }
        const { path: result, sources: srcList } = (await res.json()) as {
          path: LearningPath;
          sources?: any[];
        };
        useSessionStore.getState().setLearningPath(result);
        if (srcList) useSessionStore.getState().setLearningPathSources(srcList);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Learning path failed');
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
    if (!path) return;
    if (!confirm('Run again? The current result will be cleared.')) return;
    store.setLearningPath(null);
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
            {path && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => learningPathToMarkdown(path, sources)}
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
            <p className='text-ink-muted'>Building learning path…</p>
          </div>
        )}
        {!loading && !path && <LearningPathInputCard />}
        {!loading && path && <LearningPathView path={path} />}
      </div>
      <Toaster />
    </div>
  );
}
