// Renderer-side orchestration for the Practice Interview feature.
//
// Replaces two legacy route handlers:
//   - POST /api/interview          (app/api/interview/route.ts)        — one turn
//   - POST /api/interviewFeedback  (app/api/interviewFeedback/route.ts) — feedback
//
// The interview is multi-turn. Each runInterviewTurn() is a fresh completion
// over the whole conversation history (plus phase / difficulty / target) and
// returns the next interviewer message. Phase progression is computed locally
// via nextPhase() — no LLM round-trip needed to know when it's complete.
//
// Search-grounded for the role-specific phase only. Search failures are
// swallowed (groundingFailed=true) and the turn still runs without sources.
//
// Both LLM paths go through the structured-generation core (generate):
//   - runInterviewTurn runs in text mode with a 2-step trim ladder: trim the
//     job advert (context is rebuilt from the trimmed value), then drop history
//     to the last 20 messages. Exhausted -> rethrow (no custom message).
//   - generateInterviewFeedback runs in JSON mode with a 1-step ladder: trim
//     the transcript to the last 30 messages and prepend a heads-up note.

import { generate } from './generate';
import { search, loadSearchSettings, isSearchConfigured } from './search';
import { buildInterviewSystemPrompt } from '@/lib/prompts/interview';
import {
  buildFeedbackPrompt,
  parseFeedback,
} from '@/lib/prompts/interview-feedback';
import { buildContextBlock } from '@/lib/context-block';
import { nextPhase } from '@/lib/interview-phases';
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewFeedback,
  InterviewPhase,
  SourceRef,
  StudentProfile,
} from '@/lib/session-store';

const ADVERT_TRIM_CHARS = 4000;
const MESSAGE_TRIM_COUNT_TURN = 20;
const MESSAGE_TRIM_COUNT_FEEDBACK = 30;

const FEEDBACK_SYSTEM =
  'You are an interview coach that ONLY responds in JSON.';

// ---- runInterviewTurn ----

export type RunInterviewTurnInput = {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  phase: InterviewPhase;
  turnInPhase: number;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile | null;
};

export type RunInterviewTurnResult = {
  reply: string;
  nextPhase: InterviewPhase | null;
  nextTurnInPhase: number;
  isComplete: boolean;
  trimmed: boolean;
  sources: SourceRef[];
  groundingFailed: boolean;
};

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const filtered = messages.filter((m) => m.kind === 'message');
  const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];
  if (contextBlock) {
    out.push({ role: 'system', content: contextBlock });
  }
  for (const m of filtered) {
    out.push({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    });
  }
  return out;
}

// The mutable slice of a turn that the trim ladder shrinks. The system prompt
// and the rest of the profile are constant across attempts (closed over).
type TurnGenInput = { messages: ChatMessage[]; jobAdvert?: string };

/**
 * Run a single interviewer turn.
 *
 * On the opening turn (empty messages array) a synthetic kickoff user
 * message is seeded so providers like Anthropic — which reject a
 * system-only conversation — produce the warm-up question.
 *
 * Throws on validation failure (no target) or after the token-limit
 * retry chain is exhausted. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function runInterviewTurn(
  input: RunInterviewTurnInput
): Promise<RunInterviewTurnResult> {
  const {
    messages,
    target,
    difficulty,
    phase,
    turnInPhase,
    resumeText,
    freeText,
    jobTitle,
    jobAdvert,
    distilledProfile,
  } = input;

  if (!target || !target.trim()) {
    throw new Error('A target is required to start an interview.');
  }

  // ---- Grounding — only for the role-specific phase ----
  let sources: SourceRef[] = [];
  let groundingFailed = false;
  if (phase === 'role-specific') {
    try {
      const searchSettings = await loadSearchSettings();
      if (isSearchConfigured(searchSettings)) {
        const query = `${target} interview questions common technical behavioural`;
        sources = await search({ query, intent: 'general' });
      }
    } catch (err) {
      console.error('[interview] search failed:', err);
      groundingFailed = true;
      sources = [];
    }
  }

  const systemPrompt = buildInterviewSystemPrompt({
    target,
    difficulty,
    phase,
    turnInPhase,
    sources: sources.length > 0 ? sources : undefined,
  });

  // Anthropic (and some other providers) require at least one user/assistant
  // message — system messages alone are rejected. On the opening turn we
  // seed a synthetic kickoff so the model produces its warm-up question.
  const seededMessages: ChatMessage[] =
    messages.length === 0
      ? [
          {
            id: 'seed-start',
            role: 'user',
            content: `I'm ready to begin the practice interview for ${target}. Please start with your first question.`,
            timestamp: Date.now(),
            kind: 'message',
          },
        ]
      : messages;

  const { result: reply, trimmed } = await generate(
    {
      input: { messages: seededMessages, jobAdvert },
      buildMessages: (i) =>
        toProviderMessages(
          i.messages,
          systemPrompt,
          buildContextBlock(
            resumeText,
            freeText,
            jobTitle,
            i.jobAdvert,
            distilledProfile ?? undefined
          )
        ),
      parse: (raw) => raw,
      responseFormat: { type: 'text' },
    },
    {
      steps: [
        // 1. trim the job advert (context is rebuilt from the trimmed value)
        (i: TurnGenInput) => ({
          ...i,
          jobAdvert:
            i.jobAdvert && i.jobAdvert.length > ADVERT_TRIM_CHARS
              ? i.jobAdvert.slice(0, ADVERT_TRIM_CHARS)
              : i.jobAdvert,
        }),
        // 2. also drop history to the last 20 messages (advert stays trimmed)
        (i: TurnGenInput) => ({
          ...i,
          messages: i.messages.slice(-MESSAGE_TRIM_COUNT_TURN),
        }),
      ],
    }
  );

  const next = nextPhase(phase, turnInPhase);
  return {
    reply,
    nextPhase: next.phase,
    nextTurnInPhase: next.turnInPhase,
    isComplete: next.isComplete,
    trimmed,
    sources,
    groundingFailed,
  };
}

// ---- generateInterviewFeedback ----

export type GenerateInterviewFeedbackInput = {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  reachedPhase: InterviewPhase | null;
};

export type GenerateInterviewFeedbackResult = {
  feedback: InterviewFeedback;
  trimmed: boolean;
};

const TRIM_NOTE =
  'NOTE: This is the most recent portion of a longer transcript. Earlier messages were dropped to fit the token budget. Acknowledge this in your summary.';

// The mutable slice of a feedback request. `noted` flips on once the
// transcript has been trimmed, prepending a heads-up to the prompt.
type FeedbackGenInput = { messages: ChatMessage[]; noted: boolean };

/**
 * Generate structured end-of-interview feedback.
 *
 * Throws on validation failure (no target, empty transcript) or after the
 * token-limit retry is exhausted. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateInterviewFeedback(
  input: GenerateInterviewFeedbackInput
): Promise<GenerateInterviewFeedbackResult> {
  const { messages, target, difficulty, reachedPhase } = input;

  if (!target || !target.trim()) {
    throw new Error('A target is required to generate feedback.');
  }

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  if (userMessageCount === 0) {
    throw new Error('No interview transcript to evaluate.');
  }

  const { result: feedback, trimmed } = await generate(
    {
      input: { messages, noted: false } as FeedbackGenInput,
      buildMessages: (i) => {
        const prompt = buildFeedbackPrompt({
          target,
          difficulty,
          messages: i.messages,
          reachedPhase,
        });
        return [
          { role: 'system', content: FEEDBACK_SYSTEM },
          { role: 'user', content: i.noted ? `${TRIM_NOTE}\n\n${prompt}` : prompt },
        ];
      },
      parse: (raw) => parseFeedback(raw),
    },
    {
      steps: [
        (i: FeedbackGenInput) => ({
          messages: i.messages.slice(-MESSAGE_TRIM_COUNT_FEEDBACK),
          noted: true,
        }),
      ],
    }
  );

  return { feedback, trimmed };
}
