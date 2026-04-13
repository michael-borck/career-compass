'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import InterviewPhaseProgress from './InterviewPhaseProgress';
import { useSessionStore, type InterviewFeedback, type InterviewPhase } from '@/lib/session-store';
import { loadLLMConfig } from '@/lib/llm-client';

const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

type Props = {
  onFeedbackReady: () => void;
};

export default function InterviewChat({ onFeedbackReady }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [sending, setSending] = useState(false);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const target = store.interviewTarget ?? '';
  const difficulty = store.interviewDifficulty;
  const messages = store.interviewMessages;
  const phase = store.interviewPhase;

  async function generateFeedback(reachedPhase: InterviewPhase | null) {
    setGeneratingFeedback(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/interviewFeedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          target,
          difficulty,
          reachedPhase,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not generate feedback');
      }
      const { feedback } = (await res.json()) as { feedback: InterviewFeedback };
      store.setInterviewFeedback(feedback);
      onFeedbackReady();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not generate feedback');
    } finally {
      setGeneratingFeedback(false);
    }
  }

  async function handleSend(text: string) {
    store.addInterviewMessage({ role: 'user', content: text });
    setSending(true);
    try {
      const llmConfig = await loadLLMConfig();
      const state = useSessionStore.getState();
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.interviewMessages,
          target: state.interviewTarget ?? '',
          difficulty: state.interviewDifficulty,
          phase: state.interviewPhase,
          turnInPhase: state.interviewTurnInPhase,
          resumeText: state.resumeText ?? undefined,
          freeText: state.freeText || undefined,
          jobTitle: state.jobTitle || undefined,
          jobAdvert: state.jobAdvert || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'The interviewer could not respond');
      }
      const { reply, nextPhase: nextP, nextTurnInPhase, isComplete } =
        (await res.json()) as {
          reply: string;
          nextPhase: InterviewPhase | null;
          nextTurnInPhase: number;
          isComplete: boolean;
        };
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextP, nextTurnInPhase);
      if (isComplete) {
        // Auto-trigger feedback after wrap-up
        await generateFeedback('wrap-up');
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? `${err.message}. Try sending again.`
          : 'The interviewer couldn\'t respond. Try sending again.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleEndInterview() {
    if (!confirm('End the interview now and get feedback?')) return;
    generateFeedback(phase);
  }

  function handleReconfigure() {
    if (!confirm('Discard this interview and start over from the setup card?')) return;
    store.resetInterview();
  }

  return (
    <div className='h-full flex flex-col'>
      <div className='border-b border-border px-6 py-3 flex items-center gap-4 flex-shrink-0'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline text-[var(--text-sm)]'>
          ← Back to landing
        </Link>
        <div className='flex-1 flex items-center gap-3'>
          <span className='text-[var(--text-sm)] text-ink'>
            Practice interview · {target} · {DIFFICULTY_LABEL[difficulty]}
          </span>
          {phase && <InterviewPhaseProgress currentPhase={phase} />}
        </div>
        <button
          onClick={handleReconfigure}
          className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
        >
          Reconfigure
        </button>
        <Button variant='outline' onClick={handleEndInterview} disabled={sending || generatingFeedback}>
          End interview
        </Button>
      </div>

      <ChatMessageList messages={messages} />

      {generatingFeedback && (
        <div className='flex-shrink-0 border-t border-border px-6 py-3 text-[var(--text-sm)] text-ink-muted text-center'>
          Generating feedback…
        </div>
      )}

      <ChatComposer
        onSend={handleSend}
        disabled={sending || generatingFeedback}
      />
    </div>
  );
}
