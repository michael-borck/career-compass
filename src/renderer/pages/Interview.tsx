// Practice Interview page (renderer port of app/interview/page.tsx).
//
// Combines the three legacy components into one page that switches between
// modes based on session-store state:
//   - showSetupCard:  no messages yet, no feedback         (initial / after reset)
//   - showChat:       at least one message, no feedback    (in-progress)
//   - showFeedback:   feedback is set                      (post-interview)
//
// Multi-turn state lives entirely in the zustand session store:
//   interviewMessages, interviewTarget, interviewDifficulty,
//   interviewPhase, interviewTurnInPhase, interviewFeedback, interviewSources.
// On every send, we read the latest state via useSessionStore.getState()
// (the user-typed message is appended synchronously first), pass the full
// history to runInterviewTurn(), and append the reply when it returns.
//
// Search integration is handled inside services/interview.ts:
//   - runInterviewTurn calls search only during the role-specific phase
//   - failure → groundingFailed=true, turn still runs without sources
// We surface the failure via a toast and store accumulated sources via
// store.addInterviewSources so the feedback view can show them.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import InterviewPhaseProgress from '@/components/interview/InterviewPhaseProgress';
import InterviewImprovementItem from '@/components/interview/InterviewImprovementItem';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import SaveDocxButton from '@/components/results/SaveDocxButton';
import SourcesList from '@/components/results/SourcesList';
import {
  useSessionStore,
  type InterviewDifficulty,
  type InterviewFeedback,
  type InterviewPhase,
} from '@/lib/session-store';
import { interviewFeedbackToMarkdown } from '@/lib/markdown-export';
import { interviewFeedbackToDocx } from '@/components/interview/interview-feedback-docx';
import { buildTalkBuddyScenario } from '@/lib/talk-buddy-export';
import { downloadJsonFile } from '@/lib/download';
import {
  runInterviewTurn,
  generateInterviewFeedback,
} from '../services/interview';
import { isConfigured as isLLMConfigured } from '../services/llm';

const DIFFICULTY_OPTIONS: {
  value: InterviewDifficulty;
  label: string;
  description: string;
}[] = [
  { value: 'friendly', label: 'Friendly', description: 'Encouraging tone, gentle follow-ups' },
  { value: 'standard', label: 'Standard', description: 'Realistic first-round phone screen' },
  { value: 'tough', label: 'Tough', description: 'Pointed questions, expects clear answers' },
];

const DIFFICULTY_LABEL: Record<InterviewDifficulty, string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
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

export default function Interview() {
  const store = useSessionStore();
  const messages = store.interviewMessages;
  const feedback = store.interviewFeedback;

  // State precedence: feedback > chat > setup card.
  const showFeedback = !!feedback;
  const showChat = !showFeedback && messages.length > 0;
  const showSetupCard = !showFeedback && !showChat;

  return (
    <div className='h-full overflow-y-auto'>
      {showSetupCard && <SetupCard initialTarget={deriveInitialTarget(store)} />}
      {showChat && <Chat />}
      {showFeedback && feedback && <FeedbackView feedback={feedback} />}
      <Toaster />
    </div>
  );
}

// Pre-fill target for the setup card from existing inputs.
// Job advert wins (if present, take its first non-empty line).
// Otherwise fall back to jobTitle, then any prior interviewTarget.
function deriveInitialTarget(store: ReturnType<typeof useSessionStore.getState>): string {
  if (store.jobAdvert && store.jobAdvert.trim()) {
    const firstLine = store.jobAdvert.trim().split('\n').find((l) => l.trim());
    if (firstLine) return firstLine.slice(0, 100);
  }
  if (store.jobTitle && store.jobTitle.trim()) return store.jobTitle.trim();
  if (store.interviewTarget) return store.interviewTarget;
  return '';
}

// =====================================================================
// SetupCard
// =====================================================================

function SetupCard({ initialTarget }: { initialTarget: string }) {
  const navigate = useNavigate();
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
      navigate('/settings');
      return;
    }
    setStarting(true);
    try {
      const state = useSessionStore.getState();
      const { reply, nextPhase, nextTurnInPhase, groundingFailed } =
        await runInterviewTurn({
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
        });
      store.setInterviewSession(trimmed, difficulty);
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextPhase, nextTurnInPhase);
      if (groundingFailed) {
        toast('Web search failed — interview running without sources.', { icon: 'ℹ️' });
      }
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
        <Link to='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
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

// =====================================================================
// Chat (in-progress interview)
// =====================================================================

function Chat() {
  const store = useSessionStore();
  const [sending, setSending] = useState(false);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const target = store.interviewTarget ?? '';
  const difficulty = store.interviewDifficulty;
  const messages = store.interviewMessages;
  const phase = store.interviewPhase;

  async function runFeedback(reachedPhase: InterviewPhase | null) {
    setGeneratingFeedback(true);
    try {
      const state = useSessionStore.getState();
      const { feedback } = await generateInterviewFeedback({
        messages: state.interviewMessages,
        target: state.interviewTarget ?? '',
        difficulty: state.interviewDifficulty,
        reachedPhase,
      });
      store.setInterviewFeedback(feedback);
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
      const state = useSessionStore.getState();
      const {
        reply,
        nextPhase,
        nextTurnInPhase,
        isComplete,
        sources: turnSources,
        groundingFailed,
      } = await runInterviewTurn({
        messages: state.interviewMessages,
        target: state.interviewTarget ?? '',
        difficulty: state.interviewDifficulty,
        phase: state.interviewPhase as InterviewPhase,
        turnInPhase: state.interviewTurnInPhase,
        resumeText: state.resumeText ?? undefined,
        freeText: state.freeText || undefined,
        jobTitle: state.jobTitle || undefined,
        jobAdvert: state.jobAdvert || undefined,
        distilledProfile: state.distilledProfile ?? undefined,
      });
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextPhase, nextTurnInPhase);
      if (turnSources && turnSources.length > 0) {
        store.addInterviewSources(turnSources);
      }
      if (groundingFailed) {
        toast('Web search failed — interview running without sources.', { icon: 'ℹ️' });
      }
      if (isComplete) {
        // Auto-trigger feedback after wrap-up
        await runFeedback('wrap-up');
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? `${err.message}. Try sending again.`
          : "The interviewer couldn't respond. Try sending again."
      );
    } finally {
      setSending(false);
    }
  }

  function handleEndInterview() {
    if (!confirm('End the interview now and get feedback?')) return;
    runFeedback(phase);
  }

  function handleReconfigure() {
    if (!confirm('Discard this interview and start over from the setup card?')) return;
    store.resetInterview();
  }

  return (
    <div className='h-full flex flex-col'>
      <div className='border-b border-border px-6 py-3 flex items-center gap-4 flex-shrink-0'>
        <Link to='/' className='text-ink-quiet hover:text-ink underline text-[var(--text-sm)]'>
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

// =====================================================================
// FeedbackView (post-interview)
// =====================================================================

function FeedbackView({ feedback }: { feedback: InterviewFeedback }) {
  const navigate = useNavigate();
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
    navigate('/');
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
      const state = useSessionStore.getState();
      const { reply, nextPhase, nextTurnInPhase, groundingFailed } =
        await runInterviewTurn({
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
        });
      store.setInterviewSession(target, difficulty);
      store.addInterviewMessage({ role: 'assistant', content: reply });
      store.advanceInterviewPhase(nextPhase, nextTurnInPhase);
      if (groundingFailed) {
        toast('Web search failed — interview running without sources.', { icon: 'ℹ️' });
      }
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
        <Link to='/' className='text-ink-quiet hover:text-ink underline text-[var(--text-sm)]'>
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
        <SaveDocxButton
          getBlob={() => interviewFeedbackToDocx(feedback, interviewSources)}
          filename={`interview-feedback-${feedback.target.replace(/\s+/g, '-').toLowerCase()}.docx`}
        />
        <CopyMarkdownButton
          getMarkdown={() => interviewFeedbackToMarkdown(feedback, interviewSources)}
          label='Copy as text'
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
