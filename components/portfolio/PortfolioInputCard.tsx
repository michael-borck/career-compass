'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function PortfolioInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState(false);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const canRun = hasResume || hasFreeText;

  async function handleResumeSelect(file: File) {
    try {
      const ab = await fileToArrayBuffer(file);
      const res = await fetch('/api/parsePdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: Array.from(new Uint8Array(ab)),
          filename: file.name,
        }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const text = await res.json();
      store.setResume(text, file.name);
    } catch (err) {
      console.error(err);
      toast.error('Could not read that file. Try a different format.');
    }
  }

  async function handleRun() {
    if (!canRun) return;
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setRunning(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          jobTitle: store.jobTitle || undefined,
          jobAdvert: store.jobAdvert || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
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
      store.setPortfolio({ html, target });
      if (trimmed) toast('Input was trimmed to fit the model.', { icon: '\u2139\uFE0F' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Portfolio generation failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='border border-border rounded-lg bg-paper p-6'>
        <div className='editorial-rule justify-center mb-2'>
          <span>Portfolio page</span>
        </div>
        <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
          Your personal portfolio
        </h2>
        <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
          The more profile detail you provide, the richer the page. Add a target role to tailor it for a specific career.
        </p>

        <div className='space-y-4'>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Resume
            </label>
            <LocalFileUpload
              onFileSelect={handleResumeSelect}
              className='w-full flex items-center justify-center'
            />
            {store.resumeFilename && (
              <p className='text-[var(--text-xs)] text-ink-muted mt-1'>
                Selected: {store.resumeFilename}
              </p>
            )}
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              About you
            </label>
            <Textarea
              value={store.freeText}
              rows={3}
              onChange={(e) => store.setFreeText(e.target.value)}
              placeholder='A sentence or two about your background, interests, or goals.'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job title <span className='normal-case tracking-normal font-normal text-ink-muted'>(optional)</span>
            </label>
            <Input
              value={store.jobTitle}
              onChange={(e) => store.setJobTitle(e.target.value)}
              placeholder='e.g. Data analyst, UX researcher'
              disabled={running}
            />
          </div>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Job advert <span className='normal-case tracking-normal font-normal text-ink-muted'>(optional)</span>
            </label>
            <Textarea
              value={store.jobAdvert}
              rows={3}
              onChange={(e) => store.setJobAdvert(e.target.value)}
              placeholder='Paste a job listing or description.'
              disabled={running}
            />
          </div>

          <div className='flex justify-center pt-2'>
            <Button onClick={handleRun} disabled={!canRun || running}>
              {running ? (
                <><LoadingDots color='white' /> Generating…</>
              ) : (
                <><Globe className='w-4 h-4 mr-2' /> Generate portfolio page</>
              )}
            </Button>
          </div>

          {!canRun && (
            <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
              Add a resume or write something in About you.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
