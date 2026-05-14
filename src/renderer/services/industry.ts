// Renderer-side orchestration for the Industry Exploration feature.
//
// Replaces the legacy POST /api/industry route handler
// (app/api/industry/route.ts). All LLM calls now happen in the renderer via
// the shared chat() client. Prompt building + JSON parsing logic still lives
// in lib/prompts/industry.ts (framework-agnostic, no node-only deps).
//
// Token-limit fallback: if the model rejects the prompt, we trim the resume
// once and retry. If that still fails (or fails for any non-token reason),
// surface a user-facing error. This mirrors the legacy route's behavior 1:1.

import { chat } from './llm';
import {
  buildIndustryPrompt,
  parseIndustryExploration,
  type IndustryInput,
} from '@/lib/prompts/industry';
import { isTokenLimitError } from '@/lib/token-limit';
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

async function callOnce(input: IndustryInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildIndustryPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
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

  let trimmed = false;
  let raw: string;

  try {
    raw = await callOnce(input);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    try {
      raw = await callOnce(trimResume(input));
    } catch (err2) {
      if (!isTokenLimitError(err2)) throw err2;
      throw new Error(
        'Input is too long for the model. Try trimming your resume or about-you text.'
      );
    }
  }

  const exploration = parseIndustryExploration(raw);
  return { exploration, trimmed };
}
