// Renderer-side orchestration for the Industry Exploration feature.
//
// Replaces the legacy POST /api/industry route handler
// (app/api/industry/route.ts). All LLM calls go through the shared
// structured-generation core (generate), which owns the token-limit trim
// ladder. Prompt building + JSON parsing live in lib/prompts/industry.ts
// (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the resume once, then
// surrender with a user-facing error.

import { generate } from './generate';
import {
  buildIndustryPrompt,
  parseIndustryExploration,
  type IndustryInput,
} from '@/lib/prompts/industry';
import type { IndustryExploration } from '@/lib/session-store';

export type { IndustryInput };

export type GenerateIndustryResult = {
  exploration: IndustryExploration;
  trimmed: boolean;
};

const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You are a career exploration advisor that ONLY responds in JSON.';

function trimResume(input: IndustryInput): IndustryInput {
  return {
    ...input,
    resume: input.resume ? input.resume.slice(0, RESUME_TRIM_CHARS) : undefined,
  };
}

/**
 * Generate an industry exploration from the given input.
 *
 * Requires a non-empty industry name (matches legacy route validation).
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateIndustryExploration(
  input: IndustryInput
): Promise<GenerateIndustryResult> {
  if (!input.industry || !input.industry.trim()) {
    throw new Error('An industry name is required.');
  }

  const { result: exploration, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildIndustryPrompt(i) },
      ],
      parse: (raw) => parseIndustryExploration(raw),
    },
    {
      steps: [trimResume],
      tooLongMessage:
        'Input is too long for the model. Try trimming your resume or about-you text.',
    }
  );

  return { exploration, trimmed };
}
