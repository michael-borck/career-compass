import { memo } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSessionStore } from '@/lib/session-store';
import { MessageCircle, SearchCheck, Route as RouteIcon, Mic, Users, Columns3, X, ChevronDown, Presentation, FileText } from 'lucide-react';
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

  const router = useRouter();
  const setFocus = useSessionStore((s) => s.setFocus);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);
  const setGapAnalysis = useSessionStore((s) => s.setGapAnalysis);
  const setLearningPath = useSessionStore((s) => s.setLearningPath);
  const setStoreJobTitle = useSessionStore((s) => s.setJobTitle);
  const comparing = useSessionStore((s) => s.comparing);
  const inComparison = comparing.includes(data.jobTitle ?? '');
  const atMaxComparison = comparing.length >= 3 && !inComparison;

  function handleChatAboutThis() {
    if (!jobTitle) return;
    setFocus(jobTitle);
    addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: `— Now focused on ${jobTitle} —`,
    });
  }

  function handleAnalyseGaps() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    setGapAnalysis(null);
    router.push('/gap-analysis');
  }

  function handleLearningPath() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    setLearningPath(null);
    router.push('/learning-path');
  }

  function handlePracticeInterview() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    router.push('/interview');
  }

  function handleBoardShortcut() {
    useSessionStore.getState().setBoardPrefill({ focusRole: jobTitle });
    router.push('/board');
  }

  function handleWritePitch() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    useSessionStore.getState().setElevatorPitch(null);
    router.push('/pitch');
  }

  function handleDraftCoverLetter() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    useSessionStore.getState().setCoverLetter(null);
    router.push('/cover-letter');
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
        <div className={`border border-border rounded-lg py-4 px-7 max-w-[350px] bg-paper hover:border-ink-muted transition-colors duration-[250ms] cursor-pointer ${inComparison ? 'ring-2 ring-accent' : ''}`}>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline'>
                Actions
                <ChevronDown className='w-4 h-4 ml-2' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-64'>
              <DropdownMenuLabel>Discover</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { handleChatAboutThis(); router.push('/chat'); }}>
                <MessageCircle className='w-4 h-4 mr-2' /> Chat about this role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Assess</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleAnalyseGaps}>
                <SearchCheck className='w-4 h-4 mr-2' /> Analyse gaps for this role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLearningPath}>
                <RouteIcon className='w-4 h-4 mr-2' /> Learning path for this role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePracticeInterview}>
                <Mic className='w-4 h-4 mr-2' /> Practice interview for this role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Reflect</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleBoardShortcut}>
                <Users className='w-4 h-4 mr-2' /> Ask the board about this role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Materials</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleWritePitch}>
                <Presentation className='w-4 h-4 mr-2' /> Write a pitch for this role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDraftCoverLetter}>
                <FileText className='w-4 h-4 mr-2' /> Draft a cover letter for this role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant='outline'
            size='sm'
            onClick={() => useSessionStore.getState().toggleComparing(data.jobTitle ?? '')}
            disabled={atMaxComparison}
            title={atMaxComparison ? 'Maximum 3 roles. Remove one to add another.' : undefined}
          >
            {inComparison ? (
              <><X className='w-3 h-3 mr-1' /> Remove from comparison</>
            ) : (
              <><Columns3 className='w-3 h-3 mr-1' /> Compare this role</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(CareerNode);
