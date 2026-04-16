'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type BoardReview } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function BoardInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [framing, setFraming] = useState('');
  const [focusRole, setFocusRole] = useState('');
  const [convening, setConvening] = useState(false);

  useEffect(() => {
    const prefill = store.consumeBoardPrefill();
    if (prefill) {
      if (prefill.framing) setFraming(prefill.framing);
      if (prefill.focusRole) setFocusRole(prefill.focusRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasProfile =
    hasResume || hasFreeText || !!store.distilledProfile;

  const sessionFields: string[] = [];
  if (hasResume) sessionFields.push(store.resumeFilename ?? 'resume');
  if (hasFreeText) sessionFields.push('About you');
  if (store.distilledProfile) sessionFields.push('Distilled profile');
  if (store.jobTitle.trim()) sessionFields.push(`Job title: ${store.jobTitle.trim().slice(0, 30)}`);
  if (store.jobAdvert.trim()) sessionFields.push('Job advert');

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

  async function runConvene() {
    if (!hasProfile) return;
    if (!(await ensureProvider())) return;

    setConvening(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          framing,
          focusRole: focusRole.trim() || null,
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
        throw new Error(err.error || 'The board could not be convened.');
      }
      const { review, trimmed } = (await res.json()) as {
        review: BoardReview;
        trimmed?: boolean;
      };
      store.setBoardReview(review);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: '\u2139\uFE0F' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "The board's response wasn't quite right. Try again — sometimes a second attempt works."
      );
    } finally {
      setConvening(false);
    }
  }

  return (
    <div className='border border-border rounded-lg bg-paper p-6'>
      <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink mb-6'>
        <ArrowLeft className='w-4 h-4' />
        Back to landing
      </Link>

      <div className='editorial-rule justify-center mb-2'>
        <span>Board of advisors</span>
      </div>
      <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
        Four perspectives on your profile
      </h2>
      <p className='text-ink-muted text-center max-w-2xl mx-auto mb-6'>
        A recruiter, an HR partner, a hiring manager, and a mentor will each read your profile and
        share what they notice. They won&apos;t always agree. That&apos;s the point.
      </p>

      <div className='space-y-4'>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            What&apos;s on your mind? (optional)
          </label>
          <Textarea
            value={framing}
            rows={4}
            onChange={(e) => setFraming(e.target.value)}
            placeholder="e.g. I'm worried my degree feels too academic for industry data roles."
            disabled={convening}
          />
        </div>

        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            A specific role to centre on? (optional)
          </label>
          <Input
            value={focusRole}
            onChange={(e) => setFocusRole(e.target.value)}
            placeholder='Graduate data analyst'
            disabled={convening}
          />
        </div>

        {!hasResume && (
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
        )}

        {!hasFreeText && (
          <div>
            <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              About you
            </label>
            <Textarea
              value={store.freeText}
              rows={3}
              onChange={(e) => store.setFreeText(e.target.value)}
              placeholder='A sentence or two about your background, interests, or goals.'
              disabled={convening}
            />
          </div>
        )}

        {sessionFields.length > 0 && (
          <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
            Will also use from your session: {sessionFields.join(', ')}.
          </p>
        )}

        {!hasProfile && (
          <span className='block text-[var(--text-sm)] text-error text-center'>
            No profile material found. Return to the landing page to add a resume or fill in About
            you.
          </span>
        )}

        <div className='flex justify-center pt-2'>
          <Button onClick={runConvene} disabled={!hasProfile || convening}>
            {convening ? (
              <>
                <LoadingDots color='white' /> Convening…
              </>
            ) : (
              <>
                <Users className='w-4 h-4 mr-2' />
                Convene the board
              </>
            )}
          </Button>
        </div>

        {convening && (
          <p className='text-[var(--text-sm)] text-ink-quiet text-center italic'>
            Four advisors are reading your profile…
          </p>
        )}
      </div>
    </div>
  );
}
