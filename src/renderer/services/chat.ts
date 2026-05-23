// Renderer-side orchestration for the Chat / Career Advisor feature.
//
// Replaces three legacy route handlers:
//   - POST /api/chat            (app/api/chat/route.ts)            — one chat turn
//   - POST /api/chatSearch      (app/api/chatSearch/route.ts)      — look-up wrapper
//   - POST /api/distillProfile  (app/api/distillProfile/route.ts)  — chat → structured profile
//
// Unlike the interview, chat is NOT auto-grounded each turn. The page calls
// runChatSearch() explicitly via the "Look up" composer button and then
// passes those results into runChatTurn() via searchSources.
//
// This is non-streaming — the legacy route was also non-streaming. Both LLM
// paths go through the structured-generation core (generate):
//   - runChatTurn runs in text mode (no JSON), with a 1-step trim ladder that
//     trims history to the last 20 messages, then rethrows (no custom message).
//   - distillProfile runs in JSON mode, with a 1-step trim ladder that trims
//     history to the last 30 messages and re-flags the prompt as trimmed.

import { generate } from './generate';
import { search } from './search';
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor';
import { buildContextBlock } from '@/lib/context-block';
import {
  buildDistillationPrompt,
  parseDistilledProfile,
} from '@/lib/prompts/distill';
import { trimHistory } from '@/lib/chat-history';
import { formatSourcesForFootnote } from '@/lib/search-prompt';
import type {
  ChatMessage,
  SourceRef,
  StudentProfile,
} from '@/lib/session-store';

const MESSAGE_TRIM_COUNT_TURN = 20;
const MESSAGE_TRIM_COUNT_DISTILL = 30;

const DISTILL_SYSTEM =
  'You summarize career conversations into structured JSON profiles. Respond ONLY with JSON.';

// ---------------------------------------------------------------------------
// runChatTurn
// ---------------------------------------------------------------------------

export type RunChatTurnInput = {
  messages: ChatMessage[];
  currentFocus: string | null;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  searchSources?: SourceRef[];
};

export type RunChatTurnResult = {
  reply: string;
  trimmed: boolean;
};

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null,
  searchSources?: SourceRef[]
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  // Only real conversation messages go to the LLM. Attachment-summary,
  // focus-marker, and notice messages are UI chrome — sending them confuses
  // the model (e.g., "[Attachment shared]" made Claude think it was being
  // handed a multimodal file it couldn't read, so it refused even though the
  // actual text was already in the system prompt).
  const filtered = messages.filter((m) => m.kind === 'message');
  const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];
  if (contextBlock) {
    out.push({ role: 'system', content: contextBlock });
  }
  if (searchSources && searchSources.length > 0) {
    out.push({
      role: 'system',
      content: formatSourcesForFootnote(searchSources),
    });
  }
  for (const m of filtered) {
    out.push({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    });
  }
  return out;
}

/**
 * Run a single advisor turn. The caller is responsible for appending the
 * student's message to the history BEFORE calling this — the full history
 * (including the latest user message) is what gets sent to the LLM.
 *
 * Throws on terminal LLM failure or after the token-limit retry chain is
 * exhausted. The thrown error's `.message` is safe to surface via toast.
 */
export async function runChatTurn(
  input: RunChatTurnInput
): Promise<RunChatTurnResult> {
  const systemPrompt = buildAdvisorSystemPrompt(input.currentFocus);
  const contextBlock = buildContextBlock(
    input.resumeText,
    input.freeText,
    input.jobTitle,
    input.jobAdvert
  );

  const { result: reply, trimmed } = await generate(
    {
      input,
      buildMessages: (i) =>
        toProviderMessages(i.messages, systemPrompt, contextBlock, i.searchSources),
      parse: (raw) => raw,
      responseFormat: { type: 'text' },
    },
    {
      steps: [
        (i) => ({ ...i, messages: trimHistory(i.messages, MESSAGE_TRIM_COUNT_TURN) }),
      ],
    }
  );

  return { reply, trimmed };
}

// ---------------------------------------------------------------------------
// runChatSearch
// ---------------------------------------------------------------------------
//
// The legacy /api/chatSearch route was a one-line wrapper around the search
// service: `search({ query, intent: 'general' })`. We keep the wrapper here
// so the chat page imports only from one service module and so future
// callers can change the intent / add caching without page changes.

/**
 * Run a chat-context look-up search. Returns up to ~9 SourceRefs, or [] when
 * search is not configured. Throws SearchError on network/parse failures —
 * callers should catch and surface as a toast, not let it kill the turn.
 */
export async function runChatSearch(query: string): Promise<SourceRef[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Query is required');
  }
  return search({ query: trimmed, intent: 'general' });
}

// ---------------------------------------------------------------------------
// distillProfile
// ---------------------------------------------------------------------------

export type DistillProfileInput = {
  messages: ChatMessage[];
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  guidance?: string;
};

export type DistillProfileResult = {
  profile: StudentProfile;
  trimmed: boolean;
};

/**
 * Distill a chat transcript (plus optional resume/freeText/jobTitle/guidance)
 * into a structured StudentProfile.
 *
 * Throws if the LLM response can't be parsed as a valid profile, or after
 * the token-limit retry is exhausted. The thrown error's `.message` is safe
 * to surface via toast.
 */
export async function distillProfile(
  input: DistillProfileInput
): Promise<DistillProfileResult> {
  const { result: profile, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: DISTILL_SYSTEM },
        { role: 'user', content: buildDistillationPrompt(i) },
      ],
      parse: (raw) => parseDistilledProfile(raw),
    },
    {
      steps: [
        (i) => ({
          ...i,
          messages: trimHistory(i.messages, MESSAGE_TRIM_COUNT_DISTILL),
          trimmed: true,
        }),
      ],
    }
  );

  return { profile, trimmed };
}
