'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionStore, type InterviewDifficulty } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import { buildTalkBuddyScenario } from '@/lib/talk-buddy-export';
import { downloadJsonFile } from '@/lib/download';

type Props = {
  initialTarget: string;
};

const DIFFICULTY_OPTIONS: {
  value: InterviewDifficulty;
  label: string;
  description: string;
}[] = [
  { value: 'friendly', label: 'Friendly', description: 'Encouraging tone, gentle follow-ups' },
  { value: 'standard', label: 'Standard', description: 'Realistic first-round phone screen' },
  { value: 'tough', label: 'Tough', description: 'Pointed questions, expects clear answers' },
];

export default function InterviewSetupCard({ initialTarget }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const [target, setTarget] = useState(initialTarget);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>(store.interviewDifficulty);
  const [starting, setStarting] = useState(false);
  const [missingTarget, setMissingTarget] = useState(false);

  function handleDifficultyChange(d: InterviewDifficulty) {
    setDifficulty(d);
    store.setInterviewDifficulty(d);
  }

  function handleTargetChange(value: string) {
    setTarget(value);
    if (value.trim()) setMissingTarget(false);
    store.setJobTitle(value);
  }

  function handleExportToTalkBuddy() {
    const trimmed = target.trim();
    if (!trimmed) {
      setMissingTarget(true);
      return;
    }
    const { filename, json } = buildTalkBuddyScenario(trimmed, difficulty);
    downloadJsonFile(filename, json);
    toast.success('Scenario downloaded. Open Talk Buddy and use Upload.');
  }

  async function handleBegin() {
    const trimmed = target.trim();
    if (!trimmed) {
      setMissingTarget(true);
      return;
    }
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return;
    }
    setStarting(true);
    try {
      const llmConfig = await loadLLMConfig();
      const state = useSessionStore.getState();
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          target: trimmed,
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
        throw new Error(err.error || 'Could not start the interview');
      }
      const { reply, nextPhase: nextP, nextTurnInPhase } = (await res.json()) as {
        reply: string;
        nextPhase: any;
        nextTurnInPhase: number;
      };
      store.setInterviewSession(trimmed, difficulty);
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextP, nextTurnInPhase);
      // The page re-renders into the chat view because interviewMessages.length > 0
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not start the interview');
    } finally {
      setStarting(false);
    }
  }

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();

  const sessionFields: string[] = [];
  if (hasResume) sessionFields.push(store.resumeFilename ?? 'resume');
  if (hasFreeText) sessionFields.push('About you');
  if (hasJobAdvert) sessionFields.push('Job advert');

  return (
    <div className='max-w-2xl mx-auto px-6 py-12'>
      <div className='border border-border rounded-lg bg-paper p-8 space-y-6'>
        <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
          <ArrowLeft className='w-4 h-4' />
          Back to landing
        </Link>

        <div>
          <div className='editorial-rule'>
            <span>Practice interview</span>
          </div>
          <h1 className='text-[var(--text-2xl)] font-semibold text-ink'>
            Set up your interview
          </h1>
        </div>

        <div>
          <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Target role
          </label>
          <Input
            value={target}
            onChange={(e) => handleTargetChange(e.target.value)}
            placeholder='e.g., Data Analyst'
            className={missingTarget ? 'ring-2 ring-error' : ''}
          />
          <p className='text-[var(--text-xs)] text-ink-quiet mt-1 italic'>
            Pre-filled from your inputs. Edit if you want a different role.
          </p>
        </div>

        <div>
          <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-2'>
            Difficulty
          </div>
          <div className='space-y-2'>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className='flex items-start gap-3 cursor-pointer'
              >
                <input
                  type='radio'
                  name='difficulty'
                  value={opt.value}
                  checked={difficulty === opt.value}
                  onChange={() => handleDifficultyChange(opt.value)}
                  className='mt-1'
                />
                <div>
                  <div className='text-ink font-medium'>{opt.label}</div>
                  <div className='text-[var(--text-sm)] text-ink-muted'>{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className='border-t border-border pt-4 text-[var(--text-sm)] text-ink-muted'>
          Around 7 questions across 5 phases (warm-up, behavioural, role-specific, your questions, wrap-up). Roughly 10-15 minutes. Your transcript stays on this device.
        </div>

        {sessionFields.length > 0 && (
          <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
            Will also use from your session: {sessionFields.join(', ')}.
          </p>
        )}

        <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4'>
          <Button
            variant='outline'
            onClick={handleExportToTalkBuddy}
            title='Save as a Talk Buddy scenario for voice practice. Talk Buddy starts fresh each time — only the scenario is exported, not your transcript.'
          >
            <Download className='w-4 h-4 mr-2' />
            Export to Talk Buddy
          </Button>
          <Button onClick={handleBegin} disabled={starting}>
            {starting ? 'Starting…' : 'Begin interview →'}
          </Button>
        </div>
      </div>
    </div>
  );
}
