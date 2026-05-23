// Renderer-side orchestration for the Values Compass feature.
//
// Replaces the legacy POST /api/values route handler (app/api/values/route.ts).
// All LLM calls go through the shared structured-generation core (generate),
// which owns the token-limit trim ladder. Prompt building + JSON parsing live
// in lib/prompts/values.ts (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the resume once, then
// surrender with a user-facing error.

import { generate } from './generate';
import {
  buildValuesPrompt,
  parseValuesCompass,
  type ValuesInput,
} from '@/lib/prompts/values';
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
  const { result: compass, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildValuesPrompt(i) },
      ],
      parse: (raw) => parseValuesCompass(raw),
    },
    {
      steps: [trimResume],
      tooLongMessage:
        'Input is too long for the model. Try trimming your resume or about-you text.',
    }
  );

  return { compass, trimmed };
}
