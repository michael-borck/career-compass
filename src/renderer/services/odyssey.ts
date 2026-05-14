// Renderer-side orchestration for the Odyssey Plan feature.
//
// Replaces two legacy route handlers:
//   - POST /api/odysseySuggest  (app/api/odysseySuggest/route.ts)
//   - POST /api/odysseyElaborate (app/api/odysseyElaborate/route.ts)
//
// The feature has a two-stage workflow:
//   1. suggestLife(input)   — short LLM call, returns a seed (label + description)
//                              for one of three life types. No retry on token
//                              limit; the prompt is small and the legacy route
//                              doesn't retry either.
//   2. elaborateLife(input) — longer LLM call, takes a seed and returns a
//                              full elaboration (headline, day-in-the-life,
//                              week, tools, etc.). Includes a 3-step retry
//                              chain on token-limit errors that mirrors the
//                              legacy route 1:1: original → trim advert →
//                              trim resume → give up with a clear error.
//
// Prompt building + JSON parsing live in lib/prompts/odyssey-suggest.ts and
// lib/prompts/odyssey.ts (framework-agnostic, no node-only deps).

import { chat } from './llm';
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
import { isTokenLimitError } from '@/lib/token-limit';

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

async function callElaborate(input: OdysseyElaborateInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: ELABORATE_SYSTEM },
      { role: 'user', content: buildOdysseyElaboratePrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Suggest a single life seed for an Odyssey Plan.
 *
 * Requires a valid life type ('current' | 'pivot' | 'wildcard'). The prompt
 * is short and the legacy route does NOT retry on token limit, so this
 * function makes a single LLM call.
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

  const result = await chat({
    messages: [
      { role: 'system', content: SUGGEST_SYSTEM },
      { role: 'user', content: buildSeedSuggestionPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return parseSeedSuggestion(result.content);
}

/**
 * Elaborate a single life seed into a full Odyssey Plan entry.
 *
 * Requires a valid type, a non-empty label, and a non-empty seed.
 *
 * Token-limit retry chain (mirrors legacy /api/odysseyElaborate):
 *   1. try original input
 *   2. on token-limit error: trim jobAdvert, retry
 *   3. on token-limit error: trim resume too, retry
 *   4. on token-limit error: surrender with a user-facing error
 *
 * Non-token-limit errors are rethrown immediately without retrying.
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

  let trimmed = false;
  let raw: string;
  let current = input;

  try {
    raw = await callElaborate(current);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    current = trimAdvert(current);
    try {
      raw = await callElaborate(current);
    } catch (err2) {
      if (!isTokenLimitError(err2)) throw err2;
      current = trimResume(current);
      try {
        raw = await callElaborate(current);
      } catch (err3) {
        if (!isTokenLimitError(err3)) throw err3;
        throw new Error(
          'This life seed is too long to elaborate. Try a shorter description.'
        );
      }
    }
  }

  const elaboration = parseOdysseyElaboration(raw);
  return { elaboration, trimmed };
}
