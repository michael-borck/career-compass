// Renderer-side orchestration for the Portfolio Page feature.
//
// Replaces the legacy POST /api/portfolio route handler
// (app/api/portfolio/route.ts). All LLM calls now happen in the renderer via
// the shared chat() client. Prompt building still lives in
// lib/prompts/portfolio.ts (framework-agnostic, no node-only deps).
//
// Output: a complete, standalone HTML document. The model is instructed to
// reply with raw HTML (no markdown fences). `ensureHtml()` strips any stray
// code fences and wraps fragments in a minimal document shell, mirroring the
// legacy route's behavior 1:1.
//
// Token-limit fallback: if the model rejects the prompt, we trim the job
// advert, then the resume, then surrender with a helpful error. Same chain
// as the legacy route.

import { chat } from './llm';
import { buildPortfolioPrompt, type PortfolioInput } from '@/lib/prompts/portfolio';
import { isTokenLimitError } from '@/lib/token-limit';
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

async function callOnce(input: PortfolioInput): Promise<string> {
  const result = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildPortfolioPrompt(input) },
    ],
  });
  return result.content;
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

  let trimmed = false;
  let current = input;
  let raw: string;

  try {
    raw = await callOnce(current);
  } catch (err) {
    if (!isTokenLimitError(err)) throw err;
    trimmed = true;
    current = trimAdvert(current);
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
          'Profile too long for a portfolio page. Try trimming your resume.'
        );
      }
    }
  }

  const html = ensureHtml(raw);
  const target =
    input.jobTitle?.trim() ||
    input.jobAdvert?.trim().split('\n')[0].slice(0, 60) ||
    null;

  return { portfolio: { html, target }, trimmed };
}
