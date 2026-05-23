// Renderer-side orchestration for the Resume Review feature.
//
// Replaces the legacy POST /api/resumeReview route handler
// (app/api/resumeReview/route.ts). The LLM call goes through the shared
// structured-generation core (generate); prompt building + JSON parsing live
// in lib/prompts/resume-review.ts (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the job advert, then the
// resume, then surrender with a helpful error.

import { generate } from './generate';
import {
  buildResumeReviewPrompt,
  parseResumeReview,
  type ResumeReviewInput,
} from '@/lib/prompts/resume-review';
import type { ResumeReview } from '@/lib/session-store';

export type { ResumeReviewInput };

export type GenerateResumeReviewResult = {
  review: ResumeReview;
  trimmed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You review resumes and give structured, actionable feedback. You ONLY respond in JSON.';

function trimAdvert(input: ResumeReviewInput): ResumeReviewInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: ResumeReviewInput): ResumeReviewInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

/**
 * Generate a structured resume review from the given input.
 *
 * Throws on validation failure (no resume) or after all retries are
 * exhausted. The thrown error's `.message` is safe to surface to the user
 * via toast.
 */
export async function generateResumeReview(
  input: ResumeReviewInput
): Promise<GenerateResumeReviewResult> {
  if (!input.resume || !input.resume.trim()) {
    throw new Error('A resume is required for review.');
  }

  const { result: parsed, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildResumeReviewPrompt(i) },
      ],
      parse: (raw) => parseResumeReview(raw),
    },
    {
      steps: [trimAdvert, trimResume],
      tooLongMessage:
        'Input is too long for the model. Try trimming your resume or job advert.',
    }
  );

  const target = input.jobTitle?.trim() || null;
  const review: ResumeReview = { target, ...parsed };
  return { review, trimmed };
}
