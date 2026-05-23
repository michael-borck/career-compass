// Renderer-side orchestration for the Elevator Pitch feature.
//
// Replaces the legacy POST /api/pitch route handler (app/api/pitch/route.ts).
// All LLM calls go through the shared structured-generation core (generate),
// which owns the token-limit trim ladder. Prompt building + JSON parsing live
// in lib/prompts/pitch.ts (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the job advert, then the
// resume, then surrender with a helpful error.

import { generate } from './generate';
import {
  buildPitchPrompt,
  parsePitch,
  type PitchInput,
} from '@/lib/prompts/pitch';
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

  const { result: parsed, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPitchPrompt(i) },
      ],
      parse: (raw) => parsePitch(raw),
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
    null;
  const pitch: ElevatorPitch = { target, ...parsed };
  return { pitch, trimmed };
}
