// Renderer-side orchestration for the Resume Review feature.
//
// Replaces the legacy POST /api/resumeReview route handler
// (app/api/resumeReview/route.ts). All LLM calls now happen in the renderer
// via the shared chat() client. Prompt building + JSON parsing logic still
// lives in lib/prompts/resume-review.ts (framework-agnostic, no node-only deps).
//
// Token-limit fallback: if the model rejects the prompt, we trim the job
// advert, then the resume, then surrender with a helpful error. This mirrors
// the legacy route's behavior 1:1.

import { chat } from './llm';
import {
  buildResumeReviewPrompt,
  parseResumeReview,
  type ResumeReviewInput,
} from '@/lib/prompts/resume-review';
import { isTokenLimitError } from '@/lib/token-limit';
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

async function callOnce(input: ResumeReviewInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildResumeReviewPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
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

  let trimmed = false;
  let current = input;
  let raw: string;

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
          'Input is too long for the model. Try trimming your resume or job advert.'
        );
      }
    }
  }

  const parsed = parseResumeReview(raw);
  const target = input.jobTitle?.trim() || null;
  const review: ResumeReview = { target, ...parsed };
  return { review, trimmed };
}
