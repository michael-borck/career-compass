import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewFeedback,
  InterviewImprovement,
  InterviewPhase,
} from '@/lib/session-store';

export type FeedbackPromptInput = {
  target: string;
  difficulty: InterviewDifficulty;
  messages: ChatMessage[];
  reachedPhase: InterviewPhase | null;
};

function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.kind === 'message')
    .map((m) => {
      const speaker = m.role === 'assistant' ? 'INTERVIEWER' : 'STUDENT';
      return `${speaker}: ${m.content}`;
    })
    .join('\n\n');
}

export function buildFeedbackPrompt(input: FeedbackPromptInput): string {
  const { target, difficulty, messages, reachedPhase } = input;
  const partialNote =
    reachedPhase !== 'wrap-up'
      ? `NOTE: This interview ended early. The student did not reach the wrap-up phase. Acknowledge this in the summary and only give per-phase notes for phases the student actually reached.\n\n`
      : '';

  return `You are giving feedback on a practice job interview. Be honest but encouraging. The student is using this to improve, not to be graded.

TARGET ROLE: ${target}
DIFFICULTY: ${difficulty}

${partialNote}Read the transcript below and respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "target": string — the role name (echo the target above),
  "difficulty": string — one of "friendly" / "standard" / "tough" (echo above),
  "summary": string — 2-3 sentence honest overview,
  "strengths": string[] — 3-5 things the student did well,
  "improvements": Improvement[] — 3-5 actionable improvements, ordered by priority,
  "perPhase": PerPhase[] — one entry per phase the student reached,
  "overallRating": "developing" | "on-track" | "strong",
  "nextSteps": string[] — 2-3 things to practice next, ordered by priority
}

Each Improvement has the shape:
{
  "area": string — what to work on,
  "why": string — 1 sentence explaining why this matters,
  "example": string — REWRITE one of the student's actual answers using this technique. The example is the most valuable field — never skip it. Quote or paraphrase what the student said, then show the improved version.
}

Each PerPhase has the shape:
{
  "phase": "warm-up" | "behavioural" | "role-specific" | "your-questions" | "wrap-up",
  "note": string — 1-2 sentences specific to this phase
}

RULES:
- Reference SPECIFIC moments from the transcript when giving feedback. Quote or paraphrase actual things the student said.
- For each improvement, the "example" field MUST rewrite an actual answer from the transcript using your suggested technique. Do not skip this field.
- "overallRating" must be exactly one of: "developing" / "on-track" / "strong". Use "developing" only if the student showed fundamental gaps. Use "on-track" for solid work with clear room to grow. Use "strong" only when the student is genuinely interview-ready for this difficulty level.
- "nextSteps" should be 2-3 items maximum, ordered by priority. Pick things the student can do this week.
- Never fabricate things the student didn't say. If you don't have enough information to evaluate a phase, say so honestly in the perPhase note.

<transcript>
${formatTranscript(messages)}
</transcript>

ONLY respond with JSON. No prose, no code fences.`;
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

const VALID_RATINGS = new Set(['developing', 'on-track', 'strong']);
const VALID_PHASES = new Set(['warm-up', 'behavioural', 'role-specific', 'your-questions', 'wrap-up']);

export function parseFeedback(raw: string): InterviewFeedback {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseFeedback: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseFeedback: missing summary');
  }
  if (!Array.isArray(parsed.improvements) || parsed.improvements.length === 0) {
    throw new Error('parseFeedback: improvements must be a non-empty array');
  }

  const improvements: InterviewImprovement[] = parsed.improvements.map(
    (i: any, idx: number) => {
      if (typeof i.area !== 'string' || !i.area.trim()) {
        throw new Error(`parseFeedback: improvement ${idx} missing area`);
      }
      return {
        area: i.area,
        why: typeof i.why === 'string' ? i.why : '',
        example: typeof i.example === 'string' ? i.example : '',
      };
    }
  );

  const perPhase = Array.isArray(parsed.perPhase)
    ? parsed.perPhase
        .filter((p: any) => p && VALID_PHASES.has(p.phase))
        .map((p: any) => ({
          phase: p.phase as InterviewPhase,
          note: typeof p.note === 'string' ? p.note : '',
        }))
    : [];

  const rating = VALID_RATINGS.has(parsed.overallRating)
    ? (parsed.overallRating as 'developing' | 'on-track' | 'strong')
    : 'on-track';

  const difficulty: InterviewDifficulty =
    parsed.difficulty === 'friendly' || parsed.difficulty === 'tough'
      ? parsed.difficulty
      : 'standard';

  return {
    target: typeof parsed.target === 'string' && parsed.target.trim() ? parsed.target : 'this role',
    difficulty,
    summary: parsed.summary,
    strengths: toStringArray(parsed.strengths),
    improvements,
    perPhase,
    overallRating: rating,
    nextSteps: toStringArray(parsed.nextSteps),
  };
}
