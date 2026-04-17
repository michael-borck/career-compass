'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type ValuesCompass } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function ValuesInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [valuesSeed, setValuesSeed] = useState('');
  const [running, setRunning] = useState(false);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasSeed = !!valuesSeed.trim();
  const hasAnything = hasResume || hasFreeText || !!store.distilledProfile || hasSeed;

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
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setRunning(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: store.resumeText ?? undefined,
          aboutYou: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          valuesSeed: valuesSeed || undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Values compass failed');
      }
      const { compass, trimmed } = (await res.json()) as { compass: ValuesCompass; trimmed?: boolean };
      store.setValuesCompass(compass);
      if (trimmed) toast('Input was trimmed to fit the model.', { icon: '\u2139\uFE0F' });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Values compass failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='border border-border rounded-lg bg-paper p-6'>
        <div className='editorial-rule justify-center mb-2'>
          <span>Values compass</span>
        </div>
        <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
          What matters most to you in your work?
        </h2>
        <p className='text-ink-muted text-center max-w-lg mx-auto mb-6'>
          Identify your core work values — autonomy, impact, stability, creativity, and more.
          Works with just a few words, but richer with a resume or profile.
        </p>

        <div className='space-y-4'>
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              What matters to you? (optional)
            </label>
            <Textarea
              value={valuesSeed}
              rows={3}
              onChange={(e) => setValuesSeed(e.target.value)}
              placeholder='e.g. "I want work that feels meaningful, not just a pay cheque. I like working with people but need time to focus alone too."'
              disabled={running}
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
              rows={2}
              onChange={(e) => store.setFreeText(e.target.value)}
              placeholder='Your background or interests.'
              disabled={running}
            />
          </div>

          <div className='flex justify-center pt-2'>
            <Button onClick={handleRun} disabled={running}>
              {running ? (
                <><LoadingDots color='white' /> Reflecting…</>
              ) : (
                <><Heart className='w-4 h-4 mr-2' /> Find my values</>
              )}
            </Button>
          </div>

          {!hasAnything && (
            <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
              Write something above, or just hit the button for a starting point.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
