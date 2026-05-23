// Renderer-side orchestration for the Gap Analysis feature.
//
// Replaces the legacy POST /api/gapAnalysis route handler
// (app/api/gapAnalysis/route.ts). The LLM call goes through the shared
// structured-generation core (generate); prompt building + JSON parsing live
// in lib/prompts/gaps.ts (framework-agnostic, no node-only deps).
//
// This is the FIRST page that uses the renderer-side search subsystem
// (src/renderer/services/search/, P3-T1.5). Flow:
//   1. If `grounded` is requested and search is configured, run a web
//      search to gather supporting sources.
//   2. Pass the sources into the prompt (the prompt builder formats them
//      as inline citation candidates). Sources are gathered once and held
//      constant across token-limit retries.
//   3. Call the LLM, parse, and return analysis + sources + flags.
//
// Search failures are swallowed — the analysis still runs, just without
// citations (groundingFailed=true surfaced for telemetry).
//
// Trim ladder mirrors the legacy route exactly: a single retry with a
// trimmed job advert, then rethrow (no resume trim, no custom message).

import { generate } from './generate';
import { search, loadSearchSettings, isSearchConfigured } from './search';
import {
  buildGapAnalysisPrompt,
  parseGapAnalysis,
  type GapAnalysisInput,
} from '@/lib/prompts/gaps';
import type { GapAnalysis, SourceRef } from '@/lib/session-store';

export type { GapAnalysisInput };

export type GenerateGapAnalysisInput = GapAnalysisInput & {
  grounded?: boolean;
};

export type GenerateGapAnalysisResult = {
  analysis: GapAnalysis;
  sources: SourceRef[];
  trimmed: boolean;
  groundingFailed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;

const SYSTEM =
  'You are a career gap analyst that ONLY responds in JSON.';

function trimAdvert(input: GapAnalysisInput): GapAnalysisInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function hasTarget(input: GapAnalysisInput): boolean {
  return !!(
    (input.jobAdvert && input.jobAdvert.trim()) ||
    (input.jobTitle && input.jobTitle.trim())
  );
}

function hasProfile(input: GapAnalysisInput): boolean {
  return !!(
    (input.resume && input.resume.trim()) ||
    (input.aboutYou && input.aboutYou.trim()) ||
    input.distilledProfile
  );
}

/**
 * Run a gap analysis for the given target + profile.
 *
 * Throws on validation failure (no target / no profile) or after the
 * token-limit retry is exhausted. The thrown error's `.message` is safe
 * to surface to the user via toast.
 */
export async function generateGapAnalysis(
  input: GenerateGapAnalysisInput
): Promise<GenerateGapAnalysisResult> {
  const { grounded, ...rest } = input;

  if (!hasTarget(rest)) {
    throw new Error(
      'A target is required (paste a job advert or enter a job title).'
    );
  }
  if (!hasProfile(rest)) {
    throw new Error(
      'A profile is required (upload a resume or write something in About you).'
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
        const query = `${targetForSearch} salary skills requirements`;
        sources = await search({ query, intent: 'salary' });
      }
    } catch (err) {
      console.error('[gapAnalysis] search failed:', err);
      groundingFailed = true;
      sources = [];
    }
  }

  // ---- LLM call with token-limit retry ----
  const { result: analysis, trimmed } = await generate(
    {
      input: rest,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildGapAnalysisPrompt({ ...i, sources }) },
      ],
      parse: (raw) => parseGapAnalysis(raw),
    },
    { steps: [trimAdvert] }
  );

  return { analysis, sources, trimmed, groundingFailed };
}
