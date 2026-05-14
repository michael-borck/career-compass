// Renderer-side orchestration for the Careers feature.
//
// Replaces the legacy POST /api/getCareers route handler
// (app/api/getCareers/route.ts). All LLM calls now happen in the renderer via
// the shared chat() client. Prompt building + JSON parsing live in
// lib/prompts/careers.ts (framework-agnostic).
//
// Two-stage workflow (mirrors legacy 1:1):
//   1. suggestCareers(input)            one LLM call returning 6 basic
//                                        career suggestions.
//   2. elaborateCareer(basic, input)    one LLM call per career returning the
//                                        detail block. Six of these run in
//                                        parallel via Promise.all.
//
// The legacy route catches detail errors per-career and falls back to the
// basic info for that career — five other careers can still succeed. We keep
// that behavior in generateCareers().
//
// generateCareers(input) is the convenience entrypoint the page uses; it
// orchestrates both stages and returns the 6 final careers. suggestCareers
// and elaborateCareer are exported individually for tests and future
// fine-grained UIs (e.g. lazy-loaded details).

import { chat } from './llm';
import {
  buildCareersPrompt,
  buildCareerDetailPrompt,
  parseCareersList,
  parseCareerDetail,
  type CareersInput,
  type CareerBasicInfo,
} from '@/lib/prompts/careers';
import type { finalCareerInfo } from '@/lib/types';

export type { CareersInput, CareerBasicInfo };

const SYSTEM =
  'You are a helpful career expert that ONLY responds in JSON.';

function hasAnyInput(input: CareersInput): boolean {
  return !!(
    (input.resume && input.resume.trim()) ||
    (input.freeText && input.freeText.trim()) ||
    (input.jobTitle && input.jobTitle.trim()) ||
    (input.jobAdvert && input.jobAdvert.trim()) ||
    input.distilledProfile
  );
}

/**
 * Stage 1: ask the LLM for 6 basic career suggestions.
 *
 * Requires at least one of: resume, freeText, jobTitle, jobAdvert,
 * distilledProfile (matches the prompt builder's requirement).
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function suggestCareers(
  input: CareersInput
): Promise<CareerBasicInfo[]> {
  if (!hasAnyInput(input)) {
    throw new Error('Add a resume, job title, or some context to get started.');
  }
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildCareersPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return parseCareersList(result.content);
}

/**
 * Stage 2: ask the LLM to elaborate a single career suggestion.
 *
 * Returns the basic info merged with the detail block. The legacy route
 * runs this without retries and per-career errors are caught upstream by
 * generateCareers().
 *
 * Throws on terminal failure (network, parse, validation).
 */
export async function elaborateCareer(
  basic: CareerBasicInfo,
  input: CareersInput
): Promise<finalCareerInfo> {
  if (!basic.jobTitle || !basic.jobTitle.trim()) {
    throw new Error('elaborateCareer: a jobTitle is required.');
  }
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: buildCareerDetailPrompt(
          { jobTitle: basic.jobTitle, timeline: basic.timeline },
          input
        ),
      },
    ],
    response_format: { type: 'json_object' },
  });
  const detail = parseCareerDetail(result.content);
  return { ...basic, ...detail };
}

/**
 * Two-stage convenience entrypoint used by the Careers page.
 *
 * Runs suggestCareers() then elaborateCareer() in parallel for each of the
 * (up to 6) basic suggestions. If a per-career detail call fails, that
 * career falls back to the basic info (with empty detail fields) so the
 * other five can still surface — matches the legacy route 1:1.
 *
 * Throws only if stage 1 fails. Once stage 1 succeeds, the result is
 * always returned (possibly with some careers missing details).
 */
export async function generateCareers(
  input: CareersInput
): Promise<finalCareerInfo[]> {
  const basics = await suggestCareers(input);
  const final = await Promise.all(
    basics.map(async (basic) => {
      try {
        return await elaborateCareer(basic, input);
      } catch (err) {
        // Match legacy: log and fall back to basic info so the rest survive.
        console.error(
          '[generateCareers] detail error for',
          basic.jobTitle,
          ':',
          err
        );
        return {
          ...basic,
          workRequired: '',
          aboutTheRole: '',
          whyItsagoodfit: [],
          roadmap: [],
        };
      }
    })
  );
  return final;
}
