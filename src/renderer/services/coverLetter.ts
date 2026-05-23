// Renderer-side orchestration for the Cover Letter feature.
//
// Replaces the legacy POST /api/coverLetter route handler
// (app/api/coverLetter/route.ts). All LLM calls go through the shared
// structured-generation core (generate), which owns the token-limit trim
// ladder. Prompt building + JSON parsing live in lib/prompts/cover-letter.ts
// (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the job advert, then the
// resume, then surrender with a helpful error.

import { generate } from './generate';
import {
  buildCoverLetterPrompt,
  parseCoverLetter,
  type CoverLetterInput,
} from '@/lib/prompts/cover-letter';
import type { CoverLetter } from '@/lib/session-store';

export type { CoverLetterInput };

export type GenerateCoverLetterResult = {
  letter: CoverLetter;
  trimmed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You write professional cover letters for students. You ONLY respond in JSON.';

function trimAdvert(input: CoverLetterInput): CoverLetterInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: CoverLetterInput): CoverLetterInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

function hasTarget(input: CoverLetterInput): boolean {
  return !!(
    (input.jobTitle && input.jobTitle.trim()) ||
    (input.jobAdvert && input.jobAdvert.trim())
  );
}

/**
 * Generate a cover letter from the given input.
 *
 * Throws on validation failure (no jobTitle/jobAdvert) or after all retries
 * are exhausted. The thrown error's `.message` is safe to surface to the user
 * via toast.
 */
export async function generateCoverLetter(
  input: CoverLetterInput
): Promise<GenerateCoverLetterResult> {
  if (!hasTarget(input)) {
    throw new Error(
      'Please provide at least a job title or job advert to write a cover letter.'
    );
  }

  const { result: parsed, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildCoverLetterPrompt(i) },
      ],
      parse: (raw) => parseCoverLetter(raw),
    },
    {
      steps: [trimAdvert, trimResume],
      tooLongMessage:
        'Input is too long for the model. Try trimming your resume or job advert.',
    }
  );

  const target =
    input.jobTitle?.trim() ||
    (input.jobAdvert?.trim() ? input.jobAdvert.trim().split('\n')[0] : null) ||
    '';
  const letter: CoverLetter = { target: target || '', ...parsed };
  return { letter, trimmed };
}
