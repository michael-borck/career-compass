import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildBoardPrompt, parseBoardReview, type BoardInput } from '@/lib/prompts/board';
import { isTokenLimitError } from '@/lib/token-limit';

interface BoardRequest extends BoardInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimAdvert(input: BoardInput): BoardInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: BoardInput): BoardInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM =
  'You are a Board of Advisors simulator producing voiced perspectives plus a synthesis. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as BoardRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.freeText && input.freeText.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({
          error: 'The board needs at least a resume, an About you, or a distilled profile to review.',
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
          { role: 'user', content: buildBoardPrompt(current) },
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
            { role: 'user', content: buildBoardPrompt(current) },
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
              { role: 'user', content: buildBoardPrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({
              error: 'This profile is too long for the board to review. Try trimming your resume or About you.',
            }),
            { status: 500 }
          );
        }
      }
    }

    const parsed = parseBoardReview(raw!);
    const review = {
      framing: input.framing,
      focusRole: input.focusRole,
      voices: parsed.voices,
      synthesis: parsed.synthesis,
    };
    return new Response(JSON.stringify({ review, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[board] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
