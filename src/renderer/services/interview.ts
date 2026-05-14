// Renderer-side orchestration for the Practice Interview feature.
//
// Replaces two legacy route handlers:
//   - POST /api/interview          (app/api/interview/route.ts)        — one turn
//   - POST /api/interviewFeedback  (app/api/interviewFeedback/route.ts) — end-of-interview feedback
//
// The interview is multi-turn. Each call to runInterviewTurn() is a fresh
// LLM completion that takes the entire conversation history (plus phase /
// difficulty / target) and returns the next interviewer message. The page
// owns the message list (via zustand sessionStore) and advances the
// phase/turn counters based on the result.
//
// Phase progression is computed locally via nextPhase() from
// lib/interview-phases.ts — no LLM round-trip is needed to know when the
// interview is complete.
//
// Search-grounded for the role-specific phase only, mirroring the legacy
// route. Search failures are swallowed (groundingFailed=true) and the turn
// still runs without sources. Other phases skip the search entirely.
//
// Token-limit retry chain for runInterviewTurn (mirrors legacy):
//   1. try original input
//   2. on token-limit error: trim jobAdvert to 4000 chars, retry
//   3. on token-limit error: also drop history to last 20 messages, retry
//   4. on token-limit error: rethrow with the original LLM error message
//
// Token-limit retry chain for generateInterviewFeedback (mirrors legacy):
//   1. try original input
//   2. on token-limit error: trim transcript to last 30 messages with a
//      heads-up note prepended, retry
//   3. on token-limit error: rethrow
//
// Non-token-limit errors are rethrown immediately without retrying.

import { chat } from './llm';
import { search, loadSearchSettings, isSearchConfigured } from './search';
import { buildInterviewSystemPrompt } from '@/lib/prompts/interview';
import {
  buildFeedbackPrompt,
  parseFeedback,
} from '@/lib/prompts/interview-feedback';
import { buildContextBlock } from '@/lib/context-block';
import { nextPhase } from '@/lib/interview-phases';
import { isTokenLimitError } from '@/lib/token-limit';
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

async function callTurn(
  providerMessages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const result = await chat({ messages: providerMessages });
  return result.content;
}

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

  const fullContext = buildContextBlock(
    resumeText,
    freeText,
    jobTitle,
    jobAdvert,
    distilledProfile ?? undefined
  );

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

  let trimmed = false;
  let reply: string;

  try {
    reply = await callTurn(
      toProviderMessages(seededMessages, systemPrompt, fullContext)
    );
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    // First retry: trim job advert
    let trimmedJobAdvert = jobAdvert;
    if (jobAdvert && jobAdvert.length > ADVERT_TRIM_CHARS) {
      trimmedJobAdvert = jobAdvert.slice(0, ADVERT_TRIM_CHARS);
    }
    const trimmedContext = buildContextBlock(
      resumeText,
      freeText,
      jobTitle,
      trimmedJobAdvert,
      distilledProfile ?? undefined
    );

    try {
      reply = await callTurn(
        toProviderMessages(seededMessages, systemPrompt, trimmedContext)
      );
    } catch (err2) {
      if (!isTokenLimitError(err2)) throw err2;
      // Second retry: trim message history to last 20
      const shortMessages = seededMessages.slice(-MESSAGE_TRIM_COUNT_TURN);
      reply = await callTurn(
        toProviderMessages(shortMessages, systemPrompt, trimmedContext)
      );
    }
  }

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

async function callFeedback(userPrompt: string): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: FEEDBACK_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

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

  let trimmed = false;
  let raw: string;

  try {
    raw = await callFeedback(
      buildFeedbackPrompt({ target, difficulty, messages, reachedPhase })
    );
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    const shortMessages = messages.slice(-MESSAGE_TRIM_COUNT_FEEDBACK);
    raw = await callFeedback(
      `NOTE: This is the most recent portion of a longer transcript. Earlier messages were dropped to fit the token budget. Acknowledge this in your summary.\n\n${buildFeedbackPrompt(
        { target, difficulty, messages: shortMessages, reachedPhase }
      )}`
    );
  }

  const feedback = parseFeedback(raw);
  return { feedback, trimmed };
}
