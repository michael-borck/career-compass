'use client';

import type { InterviewPhase } from '@/lib/session-store';
import { PHASE_ORDER } from '@/lib/interview-phases';

type Props = {
  currentPhase: InterviewPhase | null;
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};

export default function InterviewPhaseProgress({ currentPhase }: Props) {
  const currentIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : PHASE_ORDER.length;

  return (
    <div className='flex items-center gap-1.5'>
      {PHASE_ORDER.map((phase, idx) => {
        let dotClass: string;
        if (idx < currentIdx) {
          dotClass = 'bg-accent';
        } else if (idx === currentIdx) {
          dotClass = 'bg-accent/50 ring-2 ring-accent/30';
        } else {
          dotClass = 'bg-border';
        }
        return (
          <div
            key={phase}
            className={`w-2 h-2 rounded-full ${dotClass}`}
            title={PHASE_LABEL[phase]}
          />
        );
      })}
    </div>
  );
}
