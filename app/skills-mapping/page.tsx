'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import { useSessionStore, type SkillsMapping } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { skillsMappingToMarkdown } from '@/lib/markdown-export';
import { skillsMappingToDocx } from '@/components/skills-mapping/skills-mapping-docx';
import LoadingDots from '@/components/ui/loadingdots';
import SkillsMappingResultView from '@/components/skills-mapping/SkillsMappingResultView';
import SkillsMappingInputCard from '@/components/skills-mapping/SkillsMappingInputCard';

export default function SkillsMappingPage() {
  const router = useRouter();
  const store = useSessionStore();
  const mapping = useSessionStore((s) => s.skillsMapping);
  const autoRanRef = useRef(false);
  const [loading, setLoading] = useState(false);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasProfile = hasResume || hasFreeText || !!store.distilledProfile;

  useEffect(() => {
    if (mapping || autoRanRef.current || !hasProfile) return;
    autoRanRef.current = true;
    (async () => {
      if (!(await isLLMConfigured())) return;
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const res = await fetch('/api/skillsMapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: store.resumeText ?? undefined,
            aboutYou: store.freeText || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            jobTitle: store.jobTitle || undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Skills mapping failed');
        }
        const { mapping: result, trimmed } = (await res.json()) as {
          mapping: SkillsMapping;
          trimmed?: boolean;
        };
        store.setSkillsMapping(result);
        if (trimmed) toast('Input was trimmed to fit the model.', { icon: '\u2139\uFE0F' });
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Skills mapping failed');
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
    store.setSkillsMapping(null);
    autoRanRef.current = false;
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-4xl'>
        <Toaster position='bottom-center' />

        {/* Top bar */}
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {mapping && (
              <>
                <SaveDocxButton
                  getBlob={() => skillsMappingToDocx(mapping)}
                  filename='skills-mapping.docx'
                />
                <CopyMarkdownButton
                  getMarkdown={() => skillsMappingToMarkdown(mapping)}
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
          <div className='flex flex-col items-center gap-4 py-20'>
            <LoadingDots />
            <p className='text-ink-muted'>Mapping your skills to professional frameworks…</p>
          </div>
        )}
        {!loading && !mapping && <SkillsMappingInputCard />}
        {!loading && mapping && <SkillsMappingResultView mapping={mapping} />}
      </div>
    </div>
  );
}
