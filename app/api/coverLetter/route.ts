import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildCoverLetterPrompt, parseCoverLetter, type CoverLetterInput } from '@/lib/prompts/cover-letter';
import { isTokenLimitError } from '@/lib/token-limit';

interface CoverLetterRequest extends CoverLetterInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimAdvert(input: CoverLetterInput): CoverLetterInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: CoverLetterInput): CoverLetterInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM =
  'You write professional cover letters for students. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as CoverLetterRequest;

    const hasTarget = !!(
      (input.jobTitle && input.jobTitle.trim()) ||
      (input.jobAdvert && input.jobAdvert.trim())
    );
    if (!hasTarget) {
      return new Response(
        JSON.stringify({
          error: 'Please provide at least a job title or job advert to write a cover letter.',
        }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;
    let current = input;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildCoverLetterPrompt(current) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = trimAdvert(current);
      try {
        raw = await provider.createCompletion(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildCoverLetterPrompt(current) },
          ],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        current = trimResume(current);
        try {
          raw = await provider.createCompletion(
            [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: buildCoverLetterPrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({
              error: 'Input is too long for the model. Try trimming your resume or job advert.',
            }),
            { status: 500 }
          );
        }
      }
    }

    const parsed = parseCoverLetter(raw!);
    const target =
      input.jobTitle?.trim() ||
      (input.jobAdvert?.trim() ? input.jobAdvert.trim().split('\n')[0] : null) ||
      null;
    const letter = { target, ...parsed };
    return new Response(JSON.stringify({ letter, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[coverLetter] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
