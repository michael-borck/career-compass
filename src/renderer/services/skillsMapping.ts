// Renderer-side orchestration for the Skills Mapping feature.
//
// Replaces the legacy POST /api/skillsMapping route handler
// (app/api/skillsMapping/route.ts). All LLM calls now happen in the renderer
// via the shared chat() client. Prompt building + JSON parsing logic still
// lives in lib/prompts/skills-mapping.ts (framework-agnostic, no node-only
// deps).
//
// Token-limit fallback: if the model rejects the prompt, we trim the resume
// once and retry. If that still fails (or fails for any non-token reason),
// surface a user-facing error. This mirrors the legacy route's behavior 1:1.

import { chat } from './llm';
import {
  buildSkillsMappingPrompt,
  parseSkillsMapping,
  type SkillsMappingInput,
} from '@/lib/prompts/skills-mapping';
import { isTokenLimitError } from '@/lib/token-limit';
import type { SkillsMapping } from '@/lib/session-store';

export type { SkillsMappingInput };

export type GenerateSkillsMappingResult = {
  mapping: SkillsMapping;
  trimmed: boolean;
};

const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You are a career skills analyst that ONLY responds in JSON.';

function trimResume(input: SkillsMappingInput): SkillsMappingInput {
  return {
    ...input,
    resume: input.resume ? input.resume.slice(0, RESUME_TRIM_CHARS) : undefined,
  };
}

async function callOnce(input: SkillsMappingInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildSkillsMappingPrompt(input) },
    ],
    response_format: { type: 'json_object' },
  });
  return result.content;
}

/**
 * Generate a skills mapping from the given input.
 *
 * Requires at least one profile signal: resume, aboutYou, or distilledProfile.
 * Matches the legacy route's validation message.
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generateSkillsMapping(
  input: SkillsMappingInput
): Promise<GenerateSkillsMappingResult> {
  const hasProfile = !!(
    (input.resume && input.resume.trim()) ||
    (input.aboutYou && input.aboutYou.trim()) ||
    input.distilledProfile
  );
  if (!hasProfile) {
    throw new Error(
      'A profile is required (upload a resume or write something in About you).'
    );
  }

  let trimmed = false;
  let raw: string;

  try {
    raw = await callOnce(input);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    try {
      raw = await callOnce(trimResume(input));
    } catch (err2) {
      if (!isTokenLimitError(err2)) throw err2;
      throw new Error(
        'Input is too long for the model. Try trimming your resume or about-you text.'
      );
    }
  }

  const mapping = parseSkillsMapping(raw);
  return { mapping, trimmed };
}
