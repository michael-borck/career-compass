// Renderer-side orchestration for the Board of Advisors feature.
//
// Replaces the legacy POST /api/board route handler (app/api/board/route.ts).
// All LLM calls now happen in the renderer via the shared chat() client.
// Prompt building + JSON parsing logic still lives in lib/prompts/board.ts
// (framework-agnostic, no node-only deps).
//
// Token-limit fallback chain (mirrors the legacy route 1:1):
//   1. Full prompt.
//   2. If token-limit error: trim jobAdvert to 4000 chars, retry.
//   3. If token-limit error: trim resume to 4000 chars, retry.
//   4. If still failing: surface a user-facing error.

import { chat } from './llm';
import {
  buildBoardPrompt,
  parseBoardReview,
  type BoardInput,
} from '@/lib/prompts/board';
import { isTokenLimitError } from '@/lib/token-limit';
import type { BoardAdvisorVoice, BoardSynthesis } from '@/lib/session-store';

export type { BoardInput };

export type GenerateBoardResult = {
  review: {
    framing: string;
    focusRole: string | null;
    voices: BoardAdvisorVoice[];
    synthesis: BoardSynthesis;
  };
  trimmed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You are a Board of Advisors simulator producing voiced perspectives plus a synthesis. You ONLY respond in JSON.';

function trimAdvert(input: BoardInput): BoardInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: BoardInput): BoardInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

async function callOnce(input: BoardInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildBoardPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Convene the board of advisors for the given input.
 *
 * The legacy route requires at least one of: resume, freeText, or
 * distilledProfile. We mirror that check here so the caller gets a clear
 * error before any LLM round-trip.
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateBoardReview(
  input: BoardInput
): Promise<GenerateBoardResult> {
  const hasProfile = !!(
    (input.resume && input.resume.trim()) ||
    (input.freeText && input.freeText.trim()) ||
    input.distilledProfile
  );
  if (!hasProfile) {
    throw new Error(
      'The board needs at least a resume, an About you, or a distilled profile to review.'
    );
  }

  let trimmed = false;
  let raw: string;
  let current = input;

  try {
    raw = await callOnce(current);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    current = trimAdvert(current);
    try {
      raw = await callOnce(current);
    } catch (err2) {
      if (!isTokenLimitError(err2)) throw err2;
      current = trimResume(current);
      try {
        raw = await callOnce(current);
      } catch (err3) {
        if (!isTokenLimitError(err3)) throw err3;
        throw new Error(
          'This profile is too long for the board to review. Try trimming your resume or About you.'
        );
      }
    }
  }

  const parsed = parseBoardReview(raw);
  return {
    review: {
      framing: input.framing,
      focusRole: input.focusRole,
      voices: parsed.voices,
      synthesis: parsed.synthesis,
    },
    trimmed,
  };
}
