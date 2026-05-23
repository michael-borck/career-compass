// Renderer-side orchestration for the Portfolio Page feature.
//
// Replaces the legacy POST /api/portfolio route handler
// (app/api/portfolio/route.ts). The LLM call goes through the shared
// structured-generation core (generate); prompt building lives in
// lib/prompts/portfolio.ts (framework-agnostic, no node-only deps).
//
// Output: a complete, standalone HTML document, not JSON — so the spec runs
// in text mode (responseFormat: { type: 'text' }, which omits response_format
// on the wire) and parses with ensureHtml() instead of a JSON parser.
// ensureHtml() strips any stray code fences and wraps fragments in a minimal
// document shell, mirroring the legacy route's behavior 1:1.
//
// Trim ladder mirrors the legacy route 1:1: trim the job advert, then the
// resume, then surrender with a helpful error.

import { generate } from './generate';
import { buildPortfolioPrompt, type PortfolioInput } from '@/lib/prompts/portfolio';
import type { Portfolio } from '@/lib/session-store';

export type { PortfolioInput };

export type GeneratePortfolioResult = {
  portfolio: Portfolio;
  trimmed: boolean;
};

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

const SYSTEM =
  'You generate standalone HTML portfolio pages. Respond with ONLY HTML. No markdown, no code fences, no explanation.';

function trimAdvert(input: PortfolioInput): PortfolioInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: PortfolioInput): PortfolioInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

function hasProfile(input: PortfolioInput): boolean {
  return !!(
    (input.resume && input.resume.trim()) ||
    (input.freeText && input.freeText.trim()) ||
    input.distilledProfile
  );
}

function ensureHtml(raw: string): string {
  let html = raw.trim();
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    return html;
  }
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Portfolio</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

/**
 * Generate a standalone HTML portfolio page from the given input.
 *
 * Requires at least one of: resume, freeText, or distilledProfile (matches
 * legacy route validation).
 *
 * Throws on terminal failure. The thrown error's `.message` is safe to
 * surface to the user via toast.
 */
export async function generatePortfolio(
  input: PortfolioInput
): Promise<GeneratePortfolioResult> {
  if (!hasProfile(input)) {
    throw new Error('Portfolio needs a resume or About you to generate from.');
  }

  const { result: html, trimmed } = await generate(
    {
      input,
      buildMessages: (i) => [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPortfolioPrompt(i) },
      ],
      parse: (raw) => ensureHtml(raw),
      responseFormat: { type: 'text' },
    },
    {
      steps: [trimAdvert, trimResume],
      tooLongMessage:
        'Profile too long for a portfolio page. Try trimming your resume.',
    }
  );

  const target =
    input.jobTitle?.trim() ||
    input.jobAdvert?.trim().split('\n')[0].slice(0, 60) ||
    null;

  return { portfolio: { html, target }, trimmed };
}
