// Renderer-side orchestration for the Values Compass feature.
//
// Replaces the legacy POST /api/values route handler (app/api/values/route.ts).
// All LLM calls now happen in the renderer via the shared chat() client.
// Prompt building + JSON parsing logic still lives in lib/prompts/values.ts
// (framework-agnostic, no node-only deps).
//
// Token-limit fallback: if the model rejects the prompt, we trim the resume
// once and retry. If that still fails (or fails for any non-token reason),
// surface a user-facing error. This mirrors the legacy route's behavior 1:1.

import { chat } from './llm';
import {
  buildValuesPrompt,
  parseValuesCompass,
  type ValuesInput,
} from '@/lib/prompts/values';
import { isTokenLimitError } from '@/lib/token-limit';
import type { ValuesCompass } from '@/lib/session-store';

export type { ValuesInput };

export type GenerateValuesResult = {
  compass: ValuesCompass;
  trimmed: boolean;
};

const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You are a career values coach that ONLY responds in JSON.';

function trimResume(input: ValuesInput): ValuesInput {
  return {
    ...input,
    resume: input.resume ? input.resume.slice(0, RESUME_TRIM_CHARS) : undefined,
  };
}

async function callOnce(input: ValuesInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildValuesPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Generate a values compass from the given input.
 *
 * The legacy route is permissive: no inputs required — the prompt handles
 * an empty profile by returning a thoughtful general starting point.
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateValuesCompass(
  input: ValuesInput
): Promise<GenerateValuesResult> {
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

  const compass = parseValuesCompass(raw);
  return { compass, trimmed };
}
