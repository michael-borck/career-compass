// Renderer-side orchestration for the Board of Advisors feature.
//
// Replaces the legacy POST /api/board route handler (app/api/board/route.ts).
// All LLM calls go through the shared structured-generation core (generate),
// which owns the token-limit trim ladder. Prompt building + JSON parsing live
// in lib/prompts/board.ts (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the job advert, then the
// resume, then surrender with a user-facing error.

import { generate } from './generate';
import {
  buildBoardPrompt,
  parseBoardReview,
  type BoardInput,
} from '@/lib/prompts/board';
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

  const { result: parsed, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildBoardPrompt(i) },
      ],
      parse: (raw) => parseBoardReview(raw),
    },
    {
      steps: [trimAdvert, trimResume],
      tooLongMessage:
        'This profile is too long for the board to review. Try trimming your resume or About you.',
    }
  );

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
