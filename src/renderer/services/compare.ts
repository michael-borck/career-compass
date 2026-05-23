// Renderer-side orchestration for the Compare feature.
//
// Replaces the legacy POST /api/compare route handler (app/api/compare/route.ts).
// All LLM calls go through the shared structured-generation core (generate),
// which owns the token-limit trim ladder. Prompt building + JSON parsing live
// in lib/prompts/compare.ts (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: first trim long target labels,
// then the resume, then surrender with a user-facing error.

import { generate } from './generate';
import {
  buildComparePrompt,
  parseComparison,
  type CompareInput,
} from '@/lib/prompts/compare';
import type { Comparison } from '@/lib/session-store';

export type { CompareInput };

export type GenerateComparisonResult = {
  comparison: Comparison;
  trimmed: boolean;
};

const TARGET_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You produce structured JSON comparisons of career paths across fixed dimensions. You ONLY respond in JSON.';

function trimTargets(input: CompareInput): CompareInput {
  return {
    ...input,
    targets: input.targets.map((t) =>
      t.label.length > TARGET_TRIM_CHARS
        ? { ...t, label: t.label.slice(0, TARGET_TRIM_CHARS) }
        : t
    ),
  };
}

function trimResume(input: CompareInput): CompareInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

/**
 * Generate a side-by-side career comparison.
 *
 * Requires 2 or 3 targets with non-empty labels (matches legacy route
 * validation).
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateComparison(
  input: CompareInput
): Promise<GenerateComparisonResult> {
  if (!Array.isArray(input.targets) || input.targets.length < 2 || input.targets.length > 3) {
    throw new Error('Comparison needs 2 or 3 targets.');
  }
  for (const t of input.targets) {
    if (!t || typeof t.label !== 'string' || !t.label.trim()) {
      throw new Error('Each target needs a non-empty label.');
    }
  }

  const { result, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildComparePrompt(i) },
      ],
      parse: (raw, i) => parseComparison(raw, i),
    },
    {
      steps: [trimTargets, trimResume],
      tooLongMessage:
        'These comparisons are too long to run together. Try shorter descriptions or remove a target.',
    }
  );

  return { comparison: result, trimmed };
}
