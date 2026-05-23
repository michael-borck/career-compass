// Renderer-side orchestration for the Skills Mapping feature.
//
// Replaces the legacy POST /api/skillsMapping route handler
// (app/api/skillsMapping/route.ts). The LLM call goes through the shared
// structured-generation core (generate); prompt building + JSON parsing live
// in lib/prompts/skills-mapping.ts (framework-agnostic, no node-only deps).
//
// Trim ladder mirrors the legacy route 1:1: trim the resume once, then
// surrender with a user-facing error.

import { generate } from './generate';
import {
  buildSkillsMappingPrompt,
  parseSkillsMapping,
  type SkillsMappingInput,
} from '@/lib/prompts/skills-mapping';
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

  const { result: mapping, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildSkillsMappingPrompt(i) },
      ],
      parse: (raw) => parseSkillsMapping(raw),
    },
    {
      steps: [trimResume],
      tooLongMessage:
        'Input is too long for the model. Try trimming your resume or about-you text.',
    }
  );

  return { mapping, trimmed };
}
