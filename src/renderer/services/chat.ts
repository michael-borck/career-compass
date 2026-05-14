// Renderer-side orchestration for the Chat / Career Advisor feature.
//
// Replaces three legacy route handlers:
//   - POST /api/chat            (app/api/chat/route.ts)            — one chat turn
//   - POST /api/chatSearch      (app/api/chatSearch/route.ts)      — look-up wrapper
//   - POST /api/distillProfile  (app/api/distillProfile/route.ts)  — chat → structured profile
//
// Unlike the interview, chat is NOT auto-grounded each turn. The page calls
// runChatSearch() explicitly via the "Look up" composer button and then
// passes those results into runChatTurn() via searchSources. Most turns run
// with searchSources=undefined and no search is performed.
//
// Like the interview port (P3-T17), this is non-streaming — the legacy route
// was also non-streaming, the page waits for the full reply before rendering.
//
// Token-limit retry chain for runChatTurn (mirrors legacy):
//   1. try original message history
//   2. on token-limit error: trim history to last 20 messages (preserving
//      older attachment-summary messages) via trimHistory, retry
//   3. on token-limit error: rethrow with the original LLM error message
//
// Token-limit retry chain for distillProfile (mirrors legacy):
//   1. try original input
//   2. on token-limit error: trim messages to last 30 (preserving attachments)
//      and re-build prompt with trimmed=true, retry
//   3. on token-limit error: rethrow
//
// Non-token-limit errors are rethrown immediately without retrying.

import { chat } from './llm';
import { search } from './search';
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor';
import { buildContextBlock } from '@/lib/context-block';
import {
  buildDistillationPrompt,
  parseDistilledProfile,
} from '@/lib/prompts/distill';
import { trimHistory } from '@/lib/chat-history';
import { isTokenLimitError } from '@/lib/token-limit';
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

async function callTurn(
  providerMessages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const result = await chat({ messages: providerMessages });
  return result.content;
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
  const {
    messages,
    currentFocus,
    resumeText,
    freeText,
    jobTitle,
    jobAdvert,
    searchSources,
  } = input;

  const systemPrompt = buildAdvisorSystemPrompt(currentFocus);
  const contextBlock = buildContextBlock(resumeText, freeText, jobTitle, jobAdvert);

  let trimmed = false;
  let reply: string;

  try {
    reply = await callTurn(
      toProviderMessages(messages, systemPrompt, contextBlock, searchSources)
    );
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    const shorter = trimHistory(messages, MESSAGE_TRIM_COUNT_TURN);
    reply = await callTurn(
      toProviderMessages(shorter, systemPrompt, contextBlock, searchSources)
    );
  }

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

async function callDistill(userPrompt: string): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: DISTILL_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

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
  let trimmed = false;
  let raw: string;

  try {
    raw = await callDistill(buildDistillationPrompt(input));
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    const shorter = trimHistory(input.messages, MESSAGE_TRIM_COUNT_DISTILL);
    raw = await callDistill(
      buildDistillationPrompt({ ...input, messages: shorter, trimmed: true })
    );
  }

  const profile = parseDistilledProfile(raw);
  return { profile, trimmed };
}
