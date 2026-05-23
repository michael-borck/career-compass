// Renderer-side orchestration for the Odyssey Plan feature.
//
// Replaces two legacy route handlers:
//   - POST /api/odysseySuggest  (app/api/odysseySuggest/route.ts)
//   - POST /api/odysseyElaborate (app/api/odysseyElaborate/route.ts)
//
// Two-stage workflow:
//   1. suggestLife(input)   — short LLM call via callStructured (no retry; the
//                              prompt is small and the legacy route doesn't
//                              retry either).
//   2. elaborateLife(input) — longer LLM call via generate, with a trim ladder
//                              that mirrors the legacy route 1:1: trim advert,
//                              then resume, then surrender.
//
// Prompt building + JSON parsing live in lib/prompts/odyssey-suggest.ts and
// lib/prompts/odyssey.ts (framework-agnostic, no node-only deps).

import { callStructured, generate } from './generate';
import {
  buildSeedSuggestionPrompt,
  parseSeedSuggestion,
  type SeedSuggestionInput,
  type SeedSuggestion,
} from '@/lib/prompts/odyssey-suggest';
import {
  buildOdysseyElaboratePrompt,
  parseOdysseyElaboration,
  type OdysseyElaborateInput,
  type OdysseyElaboration,
} from '@/lib/prompts/odyssey';

export type { SeedSuggestionInput, SeedSuggestion, OdysseyElaborateInput, OdysseyElaboration };

export type ElaborateLifeResult = {
  elaboration: OdysseyElaboration;
  trimmed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const VALID_TYPES = ['current', 'pivot', 'wildcard'] as const;

const SUGGEST_SYSTEM =
  'You propose concise, first-person life seeds for an Odyssey Plan exercise. You ONLY respond in JSON.';
const ELABORATE_SYSTEM =
  'You are a career imagination assistant helping students picture alternative 5-year futures for an Odyssey Plan exercise. You ONLY respond in JSON.';

function trimAdvert(input: OdysseyElaborateInput): OdysseyElaborateInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: OdysseyElaborateInput): OdysseyElaborateInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

/**
 * Suggest a single life seed for an Odyssey Plan.
 *
 * Requires a valid life type ('current' | 'pivot' | 'wildcard'). One LLM
 * call, no retry (the prompt is short and the legacy route does not retry).
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function suggestLife(
  input: SeedSuggestionInput
): Promise<SeedSuggestion> {
  if (!input.type || !VALID_TYPES.includes(input.type)) {
    throw new Error('A valid life type is required.');
  }

  return callStructured({
    input,
    buildMessages: (i) => [
      { role: 'system', content: SUGGEST_SYSTEM },
      { role: 'user', content: buildSeedSuggestionPrompt(i) },
    ],
    parse: (raw) => parseSeedSuggestion(raw),
  });
}

/**
 * Elaborate a single life seed into a full Odyssey Plan entry.
 *
 * Requires a valid type, a non-empty label, and a non-empty seed.
 *
 * Trim ladder mirrors the legacy /api/odysseyElaborate route 1:1: trim
 * jobAdvert, then resume, then surrender with a user-facing error.
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function elaborateLife(
  input: OdysseyElaborateInput
): Promise<ElaborateLifeResult> {
  if (!input.type || !VALID_TYPES.includes(input.type)) {
    throw new Error('A valid life type is required.');
  }
  if (!input.label || !input.label.trim()) {
    throw new Error('A label is required for this life.');
  }
  if (!input.seed || !input.seed.trim()) {
    throw new Error('A seed is required to elaborate this life.');
  }

  const { result: elaboration, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: ELABORATE_SYSTEM },
        { role: 'user', content: buildOdysseyElaboratePrompt(i) },
      ],
      parse: (raw) => parseOdysseyElaboration(raw),
    },
    {
      steps: [trimAdvert, trimResume],
      tooLongMessage:
        'This life seed is too long to elaborate. Try a shorter description.',
    }
  );

  return { elaboration, trimmed };
}
