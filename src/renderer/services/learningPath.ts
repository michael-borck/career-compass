// Renderer-side orchestration for the Learning Path feature.
//
// Replaces the legacy POST /api/learningPath route handler
// (app/api/learningPath/route.ts). All LLM calls now happen in the renderer
// via the shared chat() client. Prompt building + JSON parsing logic still
// lives in lib/prompts/learningPath.ts (framework-agnostic, no node-only deps).
//
// Search-grounded, mirroring gapAnalysis.ts:
//   1. If `grounded` is requested and search is configured, run a web
//      search to gather supporting sources (course / certification candidates).
//   2. Pass the sources into the prompt (the prompt builder formats them
//      as inline citation candidates).
//   3. Call the LLM, parse, and return path + sources + flags.
//
// Search query differs from gap-analysis: when an existing gap analysis is
// in session, we focus on the top 3 critical gaps; otherwise we fall back
// to a generic "learning path courses certifications" query. Intent is
// 'course' (gap-analysis uses 'salary').
//
// Search failures are swallowed — the path still runs, just without
// citations. This mirrors the legacy route's behaviour (try/catch around
// the search call, with `groundingFailed=true` surfaced for telemetry).
//
// Token-limit fallback: a single retry with a trimmed job advert. This
// matches the legacy route exactly (no resume trim, no second retry).

import { chat } from './llm';
import { search, loadSearchSettings, isSearchConfigured } from './search';
import {
  buildLearningPathPrompt,
  parseLearningPath,
  type LearningPathInput,
} from '@/lib/prompts/learningPath';
import { isTokenLimitError } from '@/lib/token-limit';
import type { LearningPath, SourceRef } from '@/lib/session-store';

export type { LearningPathInput };

export type GenerateLearningPathInput = LearningPathInput & {
  grounded?: boolean;
};

export type GenerateLearningPathResult = {
  path: LearningPath;
  sources: SourceRef[];
  trimmed: boolean;
  groundingFailed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;

const SYSTEM =
  'You are a career learning-path designer that ONLY responds in JSON.';

function trimAdvert(input: LearningPathInput): LearningPathInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function hasTarget(input: LearningPathInput): boolean {
  return !!(
    (input.jobAdvert && input.jobAdvert.trim()) ||
    (input.jobTitle && input.jobTitle.trim())
  );
}

async function callOnce(
  input: LearningPathInput,
  sources: SourceRef[]
): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildLearningPathPrompt({ ...input, sources }) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Build a learning path for the given target (and optional profile/gap analysis).
 *
 * Throws on validation failure (no target) or after the token-limit retry
 * is exhausted. The thrown error's `.message` is safe to surface to the
 * user via toast.
 */
export async function generateLearningPath(
  input: GenerateLearningPathInput
): Promise<GenerateLearningPathResult> {
  const { grounded, ...rest } = input;

  if (!hasTarget(rest)) {
    throw new Error(
      'A target is required (paste a job advert or enter a job title).'
    );
  }

  // ---- Grounding ----
  let sources: SourceRef[] = [];
  let groundingFailed = false;
  if (grounded) {
    try {
      const searchSettings = await loadSearchSettings();
      if (isSearchConfigured(searchSettings)) {
        const targetForSearch =
          (rest.jobTitle && rest.jobTitle.trim()) ||
          (rest.jobAdvert &&
            rest.jobAdvert.trim().split('\n')[0].slice(0, 100)) ||
          'this role';
        const topGaps = rest.gapAnalysis
          ? rest.gapAnalysis.gaps
              .filter((g) => g.severity === 'critical')
              .slice(0, 3)
              .map((g) => g.title)
              .join(' ')
          : '';
        const query = topGaps
          ? `${targetForSearch} courses ${topGaps}`
          : `${targetForSearch} learning path courses certifications`;
        sources = await search({ query, intent: 'course' });
      }
    } catch (err) {
      console.error('[learningPath] search failed:', err);
      groundingFailed = true;
      sources = [];
    }
  }

  // ---- LLM call with token-limit retry ----
  let trimmed = false;
  let raw: string;

  try {
    raw = await callOnce(rest, sources);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    const shorter = trimAdvert(rest);
    raw = await callOnce(shorter, sources);
  }

  const path = parseLearningPath(raw);
  return { path, sources, trimmed, groundingFailed };
}
