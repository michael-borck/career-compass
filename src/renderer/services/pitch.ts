// Renderer-side orchestration for the Elevator Pitch feature.
//
// Replaces the legacy POST /api/pitch route handler (app/api/pitch/route.ts).
// All LLM calls now happen in the renderer via the shared chat() client.
// Prompt building + JSON parsing logic still lives in lib/prompts/pitch.ts
// (framework-agnostic, no node-only deps).
//
// Token-limit fallback: if the model rejects the prompt, we trim the job
// advert, then the resume, then surrender with a helpful error. This mirrors
// the legacy route's behavior 1:1.

import { chat } from './llm';
import {
  buildPitchPrompt,
  parsePitch,
  type PitchInput,
} from '@/lib/prompts/pitch';
import { isTokenLimitError } from '@/lib/token-limit';
import type { ElevatorPitch } from '@/lib/session-store';

export type { PitchInput };

export type GeneratePitchResult = {
  pitch: ElevatorPitch;
  trimmed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You write elevator pitches for students. You ONLY respond in JSON.';

function trimAdvert(input: PitchInput): PitchInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: PitchInput): PitchInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

function hasAnyInput(input: PitchInput): boolean {
  return !!(
    (input.resume && input.resume.trim()) ||
    (input.freeText && input.freeText.trim()) ||
    (input.jobTitle && input.jobTitle.trim()) ||
    (input.jobAdvert && input.jobAdvert.trim()) ||
    input.distilledProfile
  );
}

async function callOnce(input: PitchInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPitchPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Generate an elevator pitch from the given input.
 *
 * Throws on validation failure (no input) or after all retries are exhausted.
 * The thrown error's `.message` is safe to surface to the user via toast.
 */
export async function generatePitch(
  input: PitchInput
): Promise<GeneratePitchResult> {
  if (!hasAnyInput(input)) {
    throw new Error(
      'Please provide at least one input field (resume, about you, job title, job advert, or profile).'
    );
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

  const parsed = parsePitch(raw);
  const target =
    input.jobTitle?.trim() ||
    (input.jobAdvert?.trim() ? input.jobAdvert.trim().split('\n')[0] : null) ||
    null;
  const pitch: ElevatorPitch = { target, ...parsed };
  return { pitch, trimmed };
}
