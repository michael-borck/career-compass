import type { InterviewDifficulty } from './session-store';
import { PHASE_ORDER, PHASE_CONFIG } from './interview-phases';

const DIFFICULTY_MAP: Record<InterviewDifficulty, 'beginner' | 'intermediate' | 'advanced'> = {
  friendly: 'beginner',
  standard: 'intermediate',
  tough: 'advanced',
};

const DIFFICULTY_LABEL: Record<InterviewDifficulty, string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

const DIFFICULTY_TONE_LOCAL: Record<InterviewDifficulty, string> = {
  friendly: 'Be encouraging and warm. Use gentle follow-ups.',
  standard: 'Be neutral and professional, like a real first-round phone screen.',
  tough: 'Be pointed and direct. Push back on vague answers with "What specifically did YOU do?"',
};

export type TalkBuddyExport = {
  filename: string;
  json: string;
};

export function buildTalkBuddyScenario(
  target: string,
  difficulty: InterviewDifficulty
): TalkBuddyExport {
  const totalTurns = PHASE_ORDER.reduce(
    (n, p) => n + PHASE_CONFIG[p].turnsPerPhase,
    0
  );
  const estimatedMinutes = Math.max(8, Math.round(totalTurns * 1.8));

  const scenario = {
    name: `Mock Interview: ${target}`,
    description: `${DIFFICULTY_LABEL[difficulty]}-difficulty practice interview for a ${target} role. ${totalTurns} questions across 5 phases (warm-up, behavioural, role-specific, your questions, wrap-up).`,
    category: 'Interview Practice',
    difficulty: DIFFICULTY_MAP[difficulty],
    estimatedMinutes,
    systemPrompt: buildExportedSystemPrompt(target, difficulty),
    initialMessage: `Hi, thanks for taking the time to chat today. Let's start with a simple one — tell me a little about yourself and what brings you to a ${target} role.`,
    tags: ['interview', 'career-compass', slugify(target)],
  };

  return {
    filename: `mock-interview-${slugify(target)}.json`,
    json: JSON.stringify(scenario, null, 2),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function buildExportedSystemPrompt(target: string, difficulty: InterviewDifficulty): string {
  return `You are conducting a practice job interview for the role of ${target}. The student is using this to prepare for real interviews.

DIFFICULTY: ${difficulty}
${DIFFICULTY_TONE_LOCAL[difficulty]}

INTERVIEW STRUCTURE — walk through these 5 phases in order:

1. WARM-UP (1 question): One easy intro like "Tell me about yourself."
2. BEHAVIOURAL (2 questions): STAR-method situational questions targeting soft skills.
3. ROLE-SPECIFIC (2 questions): Questions tied to the actual ${target} role — technical or domain depending on the role.
4. YOUR QUESTIONS (1 turn): Invite the student to ask questions back about the role or team. Respond naturally.
5. WRAP-UP (1 question): Thank them for their time and politely close the interview.

GLOBAL RULES:
- Ask exactly ONE question per message. Wait for the student's answer.
- Do not give feedback during the interview. Stay in character.
- Reference specific things from the conversation in your follow-ups.
- Do not break character. Do not say "as an AI."
- Keep messages short — 2-4 sentences max.

This is a practice interview created in Career Compass and exported to Talk Buddy for voice rehearsal.`;
}
