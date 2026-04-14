'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Compass, MessageCircle, SearchCheck, Route as RouteIcon, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore, type GapAnalysis, type LearningPath } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { settingsStore } from '@/lib/settings-store';
import { ensureUrlFetched } from '@/lib/url-fetch-client';
import type { MissingHints } from './InputsZone';

type Props = {
  setMissingHints: (h: MissingHints) => void;
  clearMissingHints: () => void;
};

type ActionId = 'careers' | 'chat' | 'gaps' | 'learn' | 'interview';

export default function ActionsZone({ setMissingHints, clearMissingHints }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [running, setRunning] = useState<ActionId | null>(null);

  function focusFirstHint() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async function handleFindCareers() {
    const fetched = await ensureUrlFetched();
    if (!fetched) return;
    clearMissingHints();
    const s = useSessionStore.getState();
    const has =
      !!s.resumeText ||
      !!s.jobTitle.trim() ||
      !!s.freeText.trim() ||
      !!s.jobAdvert.trim();
    if (!has) {
      setMissingHints({
        resume: true,
        jobTitle: true,
        aboutYou: true,
        jobAdvert: true,
        message: 'To find careers, fill at least one input above.',
      });
      focusFirstHint();
      return;
    }
    if (!(await ensureProvider())) return;
    store.setCareers(null);
    router.push('/careers');
  }

  async function handleStartChatting() {
    const fetched = await ensureUrlFetched();
    if (!fetched) return;
    clearMissingHints();
    if (!(await ensureProvider())) return;
    router.push('/chat');
  }

  async function handleGapAnalysis() {
    const fetched = await ensureUrlFetched();
    if (!fetched) return;
    clearMissingHints();
    const s = useSessionStore.getState();
    const hasTarget = !!s.jobAdvert.trim() || !!s.jobTitle.trim();
    const hasProfile = !!s.resumeText || !!s.freeText.trim() || !!s.distilledProfile;
    if (!hasTarget && !hasProfile) {
      setMissingHints({
        resume: true,
        jobTitle: true,
        aboutYou: true,
        jobAdvert: true,
        message: 'Gap analysis needs a target (job title or job advert) and a profile (resume or about you).',
      });
      focusFirstHint();
      return;
    }
    if (!hasTarget) {
      setMissingHints({
        resume: false,
        jobTitle: true,
        aboutYou: false,
        jobAdvert: true,
        message: 'Gap analysis needs a job. Paste a job advert or enter a job title.',
      });
      focusFirstHint();
      return;
    }
    if (!hasProfile) {
      setMissingHints({
        resume: true,
        jobTitle: false,
        aboutYou: true,
        jobAdvert: false,
        message: 'Gap analysis needs a profile. Upload a resume or write something in About you.',
      });
      focusFirstHint();
      return;
    }
    if (!(await ensureProvider())) return;

    setRunning('gaps');
    try {
      const llmConfig = await loadLLMConfig();
      const settings = await settingsStore.get();
      const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
      const res = await fetch('/api/gapAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: s.jobAdvert || undefined,
          jobTitle: s.jobTitle || undefined,
          resume: s.resumeText ?? undefined,
          aboutYou: s.freeText || undefined,
          distilledProfile: s.distilledProfile ?? undefined,
          grounded,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gap analysis failed');
      }
      const { analysis } = (await res.json()) as { analysis: GapAnalysis };
      store.setGapAnalysis(analysis);
      router.push('/gap-analysis');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
    } finally {
      setRunning(null);
    }
  }

  async function handleLearningPath() {
    const fetched = await ensureUrlFetched();
    if (!fetched) return;
    clearMissingHints();
    const s = useSessionStore.getState();
    const hasTarget = !!s.jobAdvert.trim() || !!s.jobTitle.trim();
    if (!hasTarget) {
      setMissingHints({
        resume: false,
        jobTitle: true,
        aboutYou: false,
        jobAdvert: true,
        message: 'Learning path needs a job. Paste a job advert or enter a job title.',
      });
      focusFirstHint();
      return;
    }
    if (!(await ensureProvider())) return;

    setRunning('learn');
    try {
      const llmConfig = await loadLLMConfig();
      const settings = await settingsStore.get();
      const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
      const res = await fetch('/api/learningPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobAdvert: s.jobAdvert || undefined,
          jobTitle: s.jobTitle || undefined,
          resume: s.resumeText ?? undefined,
          aboutYou: s.freeText || undefined,
          distilledProfile: s.distilledProfile ?? undefined,
          grounded,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Learning path failed');
      }
      const { path } = (await res.json()) as { path: LearningPath };
      store.setLearningPath(path);
      router.push('/learning-path');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Learning path failed');
    } finally {
      setRunning(null);
    }
  }

  async function handleInterview() {
    const fetched = await ensureUrlFetched();
    if (!fetched) return;
    clearMissingHints();
    const s = useSessionStore.getState();
    const hasTarget = !!s.jobAdvert.trim() || !!s.jobTitle.trim();
    if (!hasTarget) {
      setMissingHints({
        resume: false,
        jobTitle: true,
        aboutYou: false,
        jobAdvert: true,
        message: 'Practice interview needs a job. Paste a job advert or enter a job title.',
      });
      focusFirstHint();
      return;
    }
    // No LLM call here — the setup card on /interview is the universal preamble.
    // The student picks difficulty there before the first API call fires.
    router.push('/interview');
  }

  const anyRunning = running !== null;

  return (
    <div className='w-full max-w-5xl grid grid-cols-2 md:grid-cols-5 gap-3 mt-6'>
      <Button onClick={handleFindCareers} disabled={anyRunning} className='py-6'>
        <Compass className='w-4 h-4 mr-2' />
        Find my careers
      </Button>
      <Button onClick={handleStartChatting} disabled={anyRunning} variant='outline' className='py-6'>
        <MessageCircle className='w-4 h-4 mr-2' />
        Start chatting
      </Button>
      <Button onClick={handleGapAnalysis} disabled={anyRunning} variant='outline' className='py-6'>
        <SearchCheck className='w-4 h-4 mr-2' />
        {running === 'gaps' ? 'Analysing…' : 'Gap analysis'}
      </Button>
      <Button onClick={handleLearningPath} disabled={anyRunning} variant='outline' className='py-6'>
        <RouteIcon className='w-4 h-4 mr-2' />
        {running === 'learn' ? 'Building…' : 'Learning path'}
      </Button>
      <Button onClick={handleInterview} disabled={anyRunning} variant='outline' className='py-6'>
        <Mic className='w-4 h-4 mr-2' />
        Practice interview
      </Button>
    </div>
  );
}
