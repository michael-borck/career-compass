import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildOdysseyElaboratePrompt, parseOdysseyElaboration, type OdysseyElaborateInput } from '@/lib/prompts/odyssey';
import { isTokenLimitError } from '@/lib/token-limit';

interface OdysseyElaborateRequest extends OdysseyElaborateInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimAdvert(input: OdysseyElaborateInput): OdysseyElaborateInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: OdysseyElaborateInput): OdysseyElaborateInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM = 'You are a career imagination assistant helping students picture alternative 5-year futures for an Odyssey Plan exercise. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as OdysseyElaborateRequest;

    if (!input.type || !['current', 'pivot', 'wildcard'].includes(input.type)) {
      return new Response(
        JSON.stringify({ error: 'A valid life type is required.' }),
        { status: 400 }
      );
    }
    if (!input.label || !input.label.trim()) {
      return new Response(
        JSON.stringify({ error: 'A label is required for this life.' }),
        { status: 400 }
      );
    }
    if (!input.seed || !input.seed.trim()) {
      return new Response(
        JSON.stringify({ error: 'A seed is required to elaborate this life.' }),
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
          { role: 'user', content: buildOdysseyElaboratePrompt(current) },
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
            { role: 'user', content: buildOdysseyElaboratePrompt(current) },
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
              { role: 'user', content: buildOdysseyElaboratePrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({ error: 'This life seed is too long to elaborate. Try a shorter description.' }),
            { status: 500 }
          );
        }
      }
    }

    const elaboration = parseOdysseyElaboration(raw!);
    return new Response(JSON.stringify({ elaboration, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[odysseyElaborate] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
