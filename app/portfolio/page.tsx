'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import LoadingDots from '@/components/ui/loadingdots';
import PortfolioPreview from '@/components/portfolio/PortfolioPreview';
import PortfolioInputCard from '@/components/portfolio/PortfolioInputCard';

export default function PortfolioPage() {
  const router = useRouter();
  const store = useSessionStore();
  const portfolio = store.portfolio;
  const [loading, setLoading] = useState(false);
  const autoRanRef = useRef(false);

  const hasProfile = !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;

  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    const state = useSessionStore.getState();
    const hasP = !!(state.resumeText || state.freeText?.trim() || state.distilledProfile);
    if (!hasP || state.portfolio) return;

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/portfolio', {
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
          throw new Error(err.error || 'Portfolio generation failed');
        }
        const { html, target, trimmed } = (await res.json()) as {
          html: string;
          target: string | null;
          trimmed?: boolean;
        };
        useSessionStore.getState().setPortfolio({ html, target });
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: '\u2139\uFE0F' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Portfolio generation failed');
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

  function handleGenerateAnother() {
    if (!portfolio) return;
    if (!confirm('Generate another? The current portfolio will be cleared.')) return;
    store.setPortfolio(null);
    autoRanRef.current = false;
  }

  function handleSaveHtml() {
    if (!portfolio) return;
    const slug = portfolio.target
      ? portfolio.target.replace(/\s+/g, '-').toLowerCase()
      : 'personal';
    const blob = new Blob([portfolio.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${slug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Portfolio saved as HTML');
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
            {portfolio && (
              <>
                <Button variant='outline' onClick={handleSaveHtml}>
                  Save as HTML
                </Button>
                <Button variant='outline' onClick={handleGenerateAnother}>
                  Generate another
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
            <p className='text-ink-muted'>Generating your portfolio page…</p>
          </div>
        )}
        {!loading && !portfolio && <PortfolioInputCard />}
        {!loading && portfolio && <PortfolioPreview portfolio={portfolio} />}
      </div>
      <Toaster />
    </div>
  );
}
