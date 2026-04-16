'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type Comparison } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function CompareInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [target1, setTarget1] = useState('');
  const [target2, setTarget2] = useState('');
  const [target3, setTarget3] = useState('');
  const [prefillLabel, setPrefillLabel] = useState(false);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const prefill = store.consumeComparePrefill();
    if (prefill?.seedTarget) {
      setTarget1(prefill.seedTarget);
      setPrefillLabel(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRun = target1.trim().length > 0 && target2.trim().length > 0;

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

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return false;
    }
    return true;
  }

  async function runCompare() {
    if (!canRun) return;
    if (!(await ensureProvider())) return;

    setComparing(true);
    try {
      const llmConfig = await loadLLMConfig();
      const targets = [
        { label: target1.trim() },
        { label: target2.trim() },
      ];
      if (target3.trim()) targets.push({ label: target3.trim() });

      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'quick',
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
      const { comparison, trimmed } = (await res.json()) as {
        comparison: Comparison;
        trimmed?: boolean;
      };
      store.setComparison(comparison);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: '\u2139\uFE0F' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'The comparison came back garbled. Try again \u2014 a second attempt often works.'
      );
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className='border border-border rounded-lg bg-paper p-6'>
      <div className='editorial-rule justify-center mb-2'>
        <span>Compare careers</span>
      </div>
      <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
        Quick side-by-side across seven dimensions
      </h2>

      <div className='border-l-2 border-accent p-4 bg-paper-warm mb-6 mt-4'>
        <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
          Quick compare is vague. It makes assumptions about each role. For a richer
          comparison, run <strong>Find my careers</strong> first, pick 2 or 3 from the
          spider graph, and compare from there.
        </p>
      </div>

      <div className='space-y-4'>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            Target 1 {prefillLabel && <span className='text-ink-quiet'>(from landing)</span>}
          </label>
          <Textarea
            value={target1}
            rows={2}
            onChange={(e) => {
              setTarget1(e.target.value);
              setPrefillLabel(false);
            }}
            placeholder='Job title or paste a short job advert.'
            disabled={comparing}
          />
        </div>

        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            Target 2
          </label>
          <Textarea
            value={target2}
            rows={2}
            onChange={(e) => setTarget2(e.target.value)}
            placeholder='Job title (e.g. UX researcher) or paste a short job advert.'
            disabled={comparing}
          />
        </div>

        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            Target 3 <span className='text-ink-quiet'>(optional)</span>
          </label>
          <Textarea
            value={target3}
            rows={2}
            onChange={(e) => setTarget3(e.target.value)}
            placeholder='Job title or paste a short job advert.'
            disabled={comparing}
          />
        </div>

        <div>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Resume (optional)
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
            About you (optional)
          </label>
          <Textarea
            value={store.freeText}
            rows={3}
            onChange={(e) => store.setFreeText(e.target.value)}
            placeholder='A sentence or two about your background, interests, or goals.'
            disabled={comparing}
          />
        </div>

        <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
          Adding a resume or About you makes the comparison more personalised.
        </p>

        <div className='flex justify-center pt-2'>
          <Button onClick={runCompare} disabled={!canRun || comparing}>
            {comparing ? (
              <>
                <LoadingDots color='white' /> Comparing...
              </>
            ) : (
              <>
                <Columns3 className='w-4 h-4 mr-2' />
                Run comparison
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
