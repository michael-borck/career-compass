'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SourcesList from '@/components/results/SourcesList';
import InterviewImprovementItem from './InterviewImprovementItem';
import {
  useSessionStore,
  type InterviewFeedback,
  type InterviewPhase,
} from '@/lib/session-store';
import { interviewFeedbackToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig } from '@/lib/llm-client';
import { buildTalkBuddyScenario } from '@/lib/talk-buddy-export';
import { downloadJsonFile } from '@/lib/download';

type Props = {
  feedback: InterviewFeedback;
};

const RATING_LABEL: Record<InterviewFeedback['overallRating'], string> = {
  'developing': 'Developing',
  'on-track': 'On track',
  'strong': 'Strong',
};

const RATING_DOTS: Record<InterviewFeedback['overallRating'], string> = {
  'developing': '●○○',
  'on-track': '●●○',
  'strong': '●●●',
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};

const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

export default function InterviewFeedbackView({ feedback }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const interviewSources = useSessionStore((s) => s.interviewSources);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [practising, setPractising] = useState(false);

  function toggle(i: number) {
    setExpanded((e) => ({ ...e, [i]: !e[i] }));
  }

  function showAll() {
    const all: Record<number, boolean> = {};
    feedback.improvements.forEach((_, i) => (all[i] = true));
    setExpanded(all);
  }

  function hideAll() {
    setExpanded({});
  }

  const allExpanded = feedback.improvements.every((_, i) => expanded[i]);

  function handleStartOver() {
    if (!confirm('Start over? This clears your session.')) return;
    store.reset();
    router.push('/');
  }

  function handleExportToTalkBuddy() {
    const { filename, json } = buildTalkBuddyScenario(feedback.target, feedback.difficulty);
    downloadJsonFile(filename, json);
    toast.success('Scenario downloaded. Open Talk Buddy and use Upload.');
  }

  async function handlePracticeAgain() {
    if (
      !confirm(
        'Start a new interview for the same target and difficulty? Your current feedback will be cleared.'
      )
    ) {
      return;
    }
    setPractising(true);
    try {
      const target = feedback.target;
      const difficulty = feedback.difficulty;
      store.resetInterview();
      const llmConfig = await loadLLMConfig();
      const state = useSessionStore.getState();
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          target,
          difficulty,
          phase: 'warm-up',
          turnInPhase: 0,
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
        throw new Error(err.error || 'Could not restart the interview');
      }
      const { reply, nextPhase, nextTurnInPhase } = (await res.json()) as {
        reply: string;
        nextPhase: InterviewPhase | null;
        nextTurnInPhase: number;
      };
      store.setInterviewSession(target, difficulty);
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextPhase, nextTurnInPhase);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not restart');
    } finally {
      setPractising(false);
    }
  }

  return (
    <div className='max-w-4xl mx-auto px-6 py-8 space-y-8'>
      <div className='flex items-center gap-3'>
        <Link href='/' className='text-ink-quiet hover:text-ink underline text-[var(--text-sm)]'>
          ← Back to landing
        </Link>
        <div className='flex-1' />
        <span className='text-[var(--text-sm)] text-ink-muted'>
          Practice interview · {feedback.target} · {DIFFICULTY_LABEL[feedback.difficulty]}
        </span>
      </div>

      <div>
        <div className='editorial-rule'>
          <span>Interview feedback</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink'>
          Overall: {RATING_LABEL[feedback.overallRating]}{' '}
          <span className='text-accent ml-2'>{RATING_DOTS[feedback.overallRating]}</span>
        </h1>
      </div>

      <div>
        <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Summary</h2>
        <p className='text-ink-muted leading-relaxed'>{feedback.summary}</p>
      </div>

      {feedback.strengths.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>What you did well</h2>
          <ul className='space-y-1'>
            {feedback.strengths.map((s, i) => (
              <li key={i} className='flex items-start gap-2 text-ink-muted'>
                <span className='text-accent font-medium'>✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>What to work on</h2>
          <button
            type='button'
            onClick={allExpanded ? hideAll : showAll}
            className='text-[var(--text-sm)] text-ink-quiet hover:text-ink underline'
          >
            {allExpanded ? 'Hide all details' : 'Show all details'}
          </button>
        </div>
        <div className='space-y-2'>
          {feedback.improvements.map((imp, i) => (
            <InterviewImprovementItem
              key={i}
              improvement={imp}
              index={i}
              expanded={!!expanded[i]}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>

      {feedback.perPhase.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>By phase</h2>
          <div className='space-y-2'>
            {feedback.perPhase.map((p, i) => (
              <div key={i} className='flex items-start gap-3'>
                <span className='text-ink font-medium min-w-[140px]'>
                  {PHASE_LABEL[p.phase]}
                </span>
                <span className='text-ink-muted flex-1'>{p.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.nextSteps.length > 0 && (
        <div>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-2'>Next steps</h2>
          <ol className='list-decimal ml-5 space-y-1'>
            {feedback.nextSteps.map((step, i) => (
              <li key={i} className='text-ink-muted leading-relaxed'>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {interviewSources.length > 0 && (
        <SourcesList
          sources={interviewSources}
          heading='Sources consulted during this interview'
        />
      )}

      <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-6'>
        <CopyMarkdownButton
          getMarkdown={() => interviewFeedbackToMarkdown(feedback, interviewSources)}
        />
        <Button
          variant='outline'
          onClick={handleExportToTalkBuddy}
          title="Export this scenario to Talk Buddy for voice practice. Note: Talk Buddy starts fresh — your transcript and feedback don't transfer, only the role and difficulty."
        >
          <Download className='w-4 h-4 mr-2' />
          Export to Talk Buddy
        </Button>
        <Button variant='outline' onClick={handlePracticeAgain} disabled={practising}>
          {practising ? 'Starting…' : 'Practice again'}
        </Button>
        <Button variant='outline' onClick={handleStartOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
