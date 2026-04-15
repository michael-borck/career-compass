'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type BoardReview } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

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

  const hasProfile =
    !!store.resumeText || !!store.freeText.trim() || !!store.distilledProfile;

  const profileSummary: string[] = [];
  if (store.resumeText) profileSummary.push(`Resume: ${store.resumeFilename ?? 'uploaded'}`);
  if (store.freeText.trim()) profileSummary.push('About you: filled');
  if (store.distilledProfile) profileSummary.push('Distilled profile: yes');
  if (store.jobTitle.trim()) profileSummary.push(`Job title: ${store.jobTitle.trim()}`);
  if (store.jobAdvert.trim()) profileSummary.push('Job advert: pasted');

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
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
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

        <div className='text-[var(--text-sm)] text-ink-quiet'>
          {hasProfile ? (
            <>
              <span className='text-ink-muted'>Your profile:</span>{' '}
              {profileSummary.join('  ·  ')}
            </>
          ) : (
            <span className='text-error'>
              No profile material found. Return to the landing page to add a resume or fill in About
              you.
            </span>
          )}
        </div>

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
