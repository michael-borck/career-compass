// Renderer-side orchestration for the Career Story feature.
//
// Replaces the legacy POST /api/careerStory route handler
// (app/api/careerStory/route.ts). All LLM calls now happen in the renderer
// via the shared chat() client. Prompt building + JSON parsing logic still
// lives in lib/prompts/career-story.ts (framework-agnostic, no node-only
// deps).
//
// Career story is "medium" complexity: it draws on many other session
// outputs (gap analysis, learning path, board review, odyssey lives,
// values compass, etc.) as input. The page is responsible for harvesting
// those from the session store and passing them in; this service treats
// them as opaque optional fields on the input object.
//
// Token-limit fallback is two-tiered, matching the legacy route exactly:
//   1. First retry: drop all session outputs (careers, gapAnalysis,
//      learningPath, boardReview, odysseyLives, comparison, elevatorPitch,
//      coverLetter, resumeReview, interviewFeedback, valuesCompass) while
//      keeping the profile (resume, freeText, jobTitle, jobAdvert,
//      distilledProfile).
//   2. Second retry: also trim jobAdvert and resume to 4000 chars each.
//   3. If still failing with a token-limit error, surface a clear error.
// Non-token-limit errors bubble up immediately without retry.

import { chat } from './llm';
import {
  buildCareerStoryPrompt,
  parseCareerStory,
  type CareerStoryInput,
} from '@/lib/prompts/career-story';
import { isTokenLimitError } from '@/lib/token-limit';
import type { CareerStory } from '@/lib/session-store';

export type { CareerStoryInput };

export type GenerateCareerStoryResult = {
  story: CareerStory;
  trimmed: boolean;
};

const PROFILE_TRIM_CHARS = 4000;

const SYSTEM =
  'You identify career themes and write narrative career stories. You ONLY respond in JSON.';

function trimSessionOutputs(input: CareerStoryInput): CareerStoryInput {
  return {
    ...input,
    comparison: undefined,
    boardReview: undefined,
    odysseyLives: undefined,
    careers: undefined,
    gapAnalysis: undefined,
    learningPath: undefined,
    elevatorPitch: undefined,
    coverLetter: undefined,
    resumeReview: undefined,
    interviewFeedback: undefined,
    valuesCompass: undefined,
  };
}

function trimProfileText(input: CareerStoryInput): CareerStoryInput {
  return {
    ...input,
    jobAdvert: input.jobAdvert?.slice(0, PROFILE_TRIM_CHARS),
    resume: input.resume?.slice(0, PROFILE_TRIM_CHARS),
  };
}

function hasProfile(input: CareerStoryInput): boolean {
  return !!(
    (input.resume && input.resume.trim()) ||
    (input.freeText && input.freeText.trim()) ||
    input.distilledProfile
  );
}

async function callOnce(input: CareerStoryInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildCareerStoryPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Build a career story from the user's profile plus whatever other session
 * outputs they have generated so far (gap analysis, learning path, board
 * review, odyssey lives, values compass, etc.). All session outputs are
 * optional — the story works with just a resume or About you.
 *
 * Throws on validation failure (no profile) or after the token-limit
 * fallback ladder is exhausted. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateCareerStory(
  input: CareerStoryInput
): Promise<GenerateCareerStoryResult> {
  if (!hasProfile(input)) {
    throw new Error(
      'Career story needs a resume or About you to build from.'
    );
  }

  let trimmed = false;
  let raw: string;

  try {
    raw = await callOnce(input);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    // First trim: drop all session outputs, keep profile.
    const lighter = trimSessionOutputs(input);
    try {
      raw = await callOnce(lighter);
    } catch (err2) {
      if (!isTokenLimitError(err2)) throw err2;
      // Second trim: also trim jobAdvert and resume.
      const lightest = trimProfileText(lighter);
      try {
        raw = await callOnce(lightest);
      } catch (err3) {
        if (!isTokenLimitError(err3)) throw err3;
        throw new Error(
          'Too much session data to process. Try with fewer features completed.'
        );
      }
    }
  }

  const story = parseCareerStory(raw);
  return { story, trimmed };
}
