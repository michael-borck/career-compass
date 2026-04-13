import type { InterviewPhase } from './session-store';

export type PhaseConfig = {
  phase: InterviewPhase;
  turnsPerPhase: number;
  description: string;
  guidance: string;
};

export const PHASE_ORDER: InterviewPhase[] = [
  'warm-up',
  'behavioural',
  'role-specific',
  'your-questions',
  'wrap-up',
];

export const PHASE_CONFIG: Record<InterviewPhase, PhaseConfig> = {
  'warm-up': {
    phase: 'warm-up',
    turnsPerPhase: 1,
    description: 'Warm-up — one easy intro question to get the student talking.',
    guidance: 'Ask one simple opener like "Tell me about yourself" or "Walk me through your background." Be friendly. Do not probe yet.',
  },
  'behavioural': {
    phase: 'behavioural',
    turnsPerPhase: 2,
    description: 'Behavioural — STAR-method situational questions.',
    guidance: 'Ask "Tell me about a time when..." style questions. Target soft skills relevant to the role: teamwork, problem-solving, communication, dealing with ambiguity. Two questions total in this phase.',
  },
  'role-specific': {
    phase: 'role-specific',
    turnsPerPhase: 2,
    description: 'Role-specific — questions tied to the actual job.',
    guidance: 'Ask questions specific to the target role. For technical roles, ask about a relevant skill or scenario. For non-technical roles, ask about domain knowledge or methodology. Two questions total in this phase.',
  },
  'your-questions': {
    phase: 'your-questions',
    turnsPerPhase: 1,
    description: 'Your questions — invite the student to ask back.',
    guidance: 'Say something like "We have a few minutes left. What questions do you have for me about the role or the team?" Then respond naturally to whatever they ask. One turn total.',
  },
  'wrap-up': {
    phase: 'wrap-up',
    turnsPerPhase: 1,
    description: 'Wrap-up — polite close.',
    guidance: 'Thank the student for their time. Tell them this concludes the practice interview and that they can click "End interview" to see their feedback. Do not ask another question.',
  },
};

export function nextPhase(
  current: InterviewPhase,
  turnInPhase: number
): { phase: InterviewPhase | null; turnInPhase: number; isComplete: boolean } {
  const config = PHASE_CONFIG[current];
  if (turnInPhase + 1 >= config.turnsPerPhase) {
    const idx = PHASE_ORDER.indexOf(current);
    if (idx + 1 >= PHASE_ORDER.length) {
      return { phase: null, turnInPhase: 0, isComplete: true };
    }
    return { phase: PHASE_ORDER[idx + 1], turnInPhase: 0, isComplete: false };
  }
  return { phase: current, turnInPhase: turnInPhase + 1, isComplete: false };
}
