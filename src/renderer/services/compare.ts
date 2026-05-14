// Renderer-side orchestration for the Compare feature.
//
// Replaces the legacy POST /api/compare route handler (app/api/compare/route.ts).
// All LLM calls now happen in the renderer via the shared chat() client.
// Prompt building + JSON parsing logic still lives in lib/prompts/compare.ts
// (framework-agnostic, no node-only deps).
//
// Token-limit fallback: the legacy route retries up to twice — first trimming
// long target labels, then trimming the resume. After two trimmed retries it
// surrenders with a user-facing error. This mirrors that behavior 1:1.

import { chat } from './llm';
import {
  buildComparePrompt,
  parseComparison,
  type CompareInput,
} from '@/lib/prompts/compare';
import { isTokenLimitError } from '@/lib/token-limit';
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

async function callOnce(input: CompareInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildComparePrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
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

  let trimmed = false;
  let raw: string;
  let current = input;

  try {
    raw = await callOnce(current);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    current = trimTargets(current);
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
          'These comparisons are too long to run together. Try shorter descriptions or remove a target.'
        );
      }
    }
  }

  const comparison = parseComparison(raw, current);
  return { comparison, trimmed };
}
