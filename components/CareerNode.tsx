import { memo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';
import type { GapAnalysis, LearningPath } from '@/lib/session-store';
import { MessageCircle, SearchCheck, Route as RouteIcon, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { loadLLMConfig } from '@/lib/llm-client';

type CareerNodeProps = {
  jobTitle?: string;
  jobDescription?: string;
  timeline?: string;
  salary?: string;
  difficulty?: string;
  connectPosition?: string;
  label?: string;
  workRequired?: string;
  aboutTheRole?: string;
  whyItsagoodfit?: string[];
  roadmap?: { [key: string]: string }[];
};

function CareerNode({ data }: NodeProps<CareerNodeProps>) {
  const {
    jobTitle,
    jobDescription,
    timeline,
    salary,
    difficulty,
    connectPosition,
    workRequired,
    aboutTheRole,
    whyItsagoodfit,
    roadmap,
  } = data;
  const position = connectPosition === 'top' ? Position.Top : Position.Bottom;

  const router = useRouter();
  const setFocus = useSessionStore((s) => s.setFocus);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);
  const setGapAnalysis = useSessionStore((s) => s.setGapAnalysis);
  const setLearningPath = useSessionStore((s) => s.setLearningPath);
  const setStoreJobTitle = useSessionStore((s) => s.setJobTitle);
  const [running, setRunning] = useState<'gaps' | 'learn' | null>(null);

  function handleChatAboutThis() {
    if (!jobTitle) return;
    setFocus(jobTitle);
    addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: `— Now focused on ${jobTitle} —`,
    });
  }

  async function handleAnalyseGaps() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    setRunning('gaps');
    try {
      const state = useSessionStore.getState();
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/gapAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle,
          resume: state.resumeText ?? undefined,
          aboutYou: state.freeText || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Gap analysis failed');
      }
      const { analysis } = (await res.json()) as { analysis: GapAnalysis };
      setGapAnalysis(analysis);
      router.push('/gap-analysis');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Gap analysis failed');
    } finally {
      setRunning(null);
    }
  }

  async function handleLearningPath() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    setRunning('learn');
    try {
      const state = useSessionStore.getState();
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/learningPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle,
          resume: state.resumeText ?? undefined,
          aboutYou: state.freeText || undefined,
          distilledProfile: state.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Learning path failed');
      }
      const { path } = (await res.json()) as { path: LearningPath };
      setLearningPath(path);
      router.push('/learning-path');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Learning path failed');
    } finally {
      setRunning(null);
    }
  }

  function handlePracticeInterview() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    router.push('/interview');
  }

  const difficultyColor =
    difficulty?.toLowerCase() === 'low'
      ? 'text-accent'
      : difficulty?.toLowerCase() === 'high'
      ? 'text-error'
      : 'text-ink-muted';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className='border border-border rounded-lg py-4 px-7 max-w-[350px] bg-paper hover:border-ink-muted transition-colors duration-[250ms] cursor-pointer'>
          <Handle type='target' position={position} />
          <h1 className='text-[var(--text-xl)] font-semibold mb-2 text-ink'>{jobTitle}</h1>
          <p className='mb-4 text-ink-muted'>{jobDescription}</p>
          <div className='flex flex-col gap-1'>
            <div className='flex justify-between'>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.22em] text-ink-quiet'>Timeline</div>
              <div className='font-medium text-ink'>{timeline}</div>
            </div>
            <div className='flex justify-between'>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.22em] text-ink-quiet'>Salary</div>
              <div className='font-medium text-ink'>{salary}</div>
            </div>
            <div className='flex justify-between'>
              <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.22em] text-ink-quiet'>Difficulty</div>
              <div className={`font-medium ${difficultyColor}`}>
                {difficulty}
              </div>
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className='sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle className='flex justify-between'>
            <div className='flex items-center gap-3'>
              <span className='text-[var(--text-2xl)] font-semibold'>{jobTitle}</span>
              <span className='border border-border rounded-lg px-3 py-1 text-[var(--text-sm)] text-ink-muted'>
                {timeline}
              </span>
              <span className='border border-border rounded-lg px-3 py-1 text-[var(--text-sm)] text-ink-muted'>
                {salary}
              </span>
              <span
                className={`border border-border rounded-lg px-3 py-1 text-[var(--text-sm)] font-medium ${difficultyColor}`}
              >
                {difficulty}
              </span>
            </div>
            <div className='flex items-center gap-3 mr-5'>
              <div className='font-semibold text-ink'>Work required:</div>
              <span className='border border-border rounded-lg px-3 py-1 text-[var(--text-sm)] text-ink-muted'>
                {workRequired ?? '10-20 hrs/week'}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className='flex gap-7 border-t border-border pt-6'>
          <div className='flex flex-col gap-4 w-2/5'>
            <div>
              <h2 className='text-[var(--text-lg)] font-semibold mb-2 text-ink'>
                What does a {jobTitle} do?
              </h2>
              <p className='text-ink-muted leading-relaxed'>
                {aboutTheRole ??
                  `SEO Specialists optimize websites to rank higher in search
                engine results, aiming to increase online visibility, drive
                organic traffic, and improve user engagement.`}
              </p>
            </div>
            <div>
              <h2 className='text-[var(--text-lg)] font-semibold mb-2 mt-6 text-ink'>
                Why it could be a good fit
              </h2>
              <ul className='list-disc ml-4 text-ink-muted leading-relaxed'>
                {whyItsagoodfit?.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className='w-3/5'>
            <h2 className='text-[var(--text-lg)] font-semibold mb-2 text-ink'>Roadmap</h2>
            <div className='flex flex-col gap-2'>
              {roadmap?.map((step, index) => (
                <div key={index} className='flex gap-3'>
                  <div className='text-ink-quiet min-w-28'>
                    {Object.keys(step)[0]}:
                  </div>
                  <div className='text-ink-muted'>{Object.values(step)[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4 mt-4'>
          <Button asChild variant='outline' onClick={handleChatAboutThis}>
            <Link href='/chat'>
              <MessageCircle className='w-4 h-4 mr-2' />
              Chat about this
            </Link>
          </Button>
          <Button variant='outline' onClick={handleAnalyseGaps} disabled={running !== null}>
            <SearchCheck className='w-4 h-4 mr-2' />
            {running === 'gaps' ? 'Analysing…' : 'Analyse gaps for this role'}
          </Button>
          <Button variant='outline' onClick={handleLearningPath} disabled={running !== null}>
            <RouteIcon className='w-4 h-4 mr-2' />
            {running === 'learn' ? 'Building…' : 'Learning path for this role'}
          </Button>
          <Button variant='outline' onClick={handlePracticeInterview} disabled={running !== null}>
            <Mic className='w-4 h-4 mr-2' />
            Practice interview for this role
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(CareerNode);
