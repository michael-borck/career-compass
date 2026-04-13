import { memo } from 'react';
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
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  const setFocus = useSessionStore((s) => s.setFocus);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);

  function handleChatAboutThis() {
    if (!jobTitle) return;
    setFocus(jobTitle);
    addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: `— Now focused on ${jobTitle} —`,
    });
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
        <div className='flex justify-end border-t border-border pt-4 mt-4'>
          <Button asChild variant='outline' onClick={handleChatAboutThis}>
            <Link href='/chat'>
              <MessageCircle className='w-4 h-4 mr-2' />
              Chat about this
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(CareerNode);
