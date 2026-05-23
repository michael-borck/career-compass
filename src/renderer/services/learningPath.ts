// Renderer-side orchestration for the Learning Path feature.
//
// Replaces the legacy POST /api/learningPath route handler
// (app/api/learningPath/route.ts). The LLM call goes through the shared
// structured-generation core (generate); prompt building + JSON parsing live
// in lib/prompts/learningPath.ts (framework-agnostic, no node-only deps).
//
// Search-grounded, mirroring gapAnalysis.ts:
//   1. If `grounded` is requested and search is configured, run a web
//      search to gather supporting sources (course / certification candidates).
//   2. Pass the sources into the prompt (held constant across retries).
//   3. Call the LLM, parse, and return path + sources + flags.
//
// Search query differs from gap-analysis: when an existing gap analysis is
// in session, we focus on the top 3 critical gaps; otherwise we fall back
// to a generic "learning path courses certifications" query. Intent is
// 'course' (gap-analysis uses 'salary').
//
// Search failures are swallowed (groundingFailed=true surfaced for telemetry).
//
// Trim ladder mirrors the legacy route exactly: a single retry with a
// trimmed job advert, then rethrow (no resume trim, no custom message).

import { generate } from './generate';
import { search, loadSearchSettings, isSearchConfigured } from './search';
import {
  buildLearningPathPrompt,
  parseLearningPath,
  type LearningPathInput,
} from '@/lib/prompts/learningPath';
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
  const { result: path, trimmed } = await generate(
    {
      input: rest,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildLearningPathPrompt({ ...i, sources }) },
      ],
      parse: (raw) => parseLearningPath(raw),
    },
    { steps: [trimAdvert] }
  );

  return { path, sources, trimmed, groundingFailed };
}
