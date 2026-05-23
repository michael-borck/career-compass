// Renderer-side orchestration for the Career Story feature.
//
// Replaces the legacy POST /api/careerStory route handler
// (app/api/careerStory/route.ts). The LLM call goes through the shared
// structured-generation core (generate); prompt building + JSON parsing live
// in lib/prompts/career-story.ts (framework-agnostic, no node-only deps).
//
// Career story is "medium" complexity: it draws on many other session
// outputs (gap analysis, learning path, board review, odyssey lives,
// values compass, etc.) as input. The page harvests those from the session
// store and passes them in; this service treats them as opaque optional
// fields on the input object.
//
// Trim ladder mirrors the legacy route exactly:
//   1. First step: drop all session outputs, keep the profile.
//   2. Second step: also trim jobAdvert and resume to 4000 chars each.
//   3. Exhausted: surface a clear error.

import { generate } from './generate';
import {
  buildCareerStoryPrompt,
  parseCareerStory,
  type CareerStoryInput,
} from '@/lib/prompts/career-story';
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

/**
 * Build a career story from the user's profile plus whatever other session
 * outputs they have generated so far. All session outputs are optional — the
 * story works with just a resume or About you.
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

  const { result: story, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildCareerStoryPrompt(i) },
      ],
      parse: (raw) => parseCareerStory(raw),
    },
    {
      steps: [trimSessionOutputs, trimProfileText],
      tooLongMessage:
        'Too much session data to process. Try with fewer features completed.',
    }
  );

  return { story, trimmed };
}
