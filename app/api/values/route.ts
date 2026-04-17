import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildValuesPrompt, parseValuesCompass, type ValuesInput } from '@/lib/prompts/values';
import { isTokenLimitError } from '@/lib/token-limit';

interface ValuesRequest extends ValuesInput {
  llmConfig?: LLMConfig;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as ValuesRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[values] incoming:', {
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
      hasValuesSeed: !!input.valuesSeed,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career values coach that ONLY responds in JSON.' },
          { role: 'user', content: buildValuesPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter: ValuesInput = {
        ...input,
        resume: input.resume ? input.resume.slice(0, 4000) : undefined,
      };
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career values coach that ONLY responds in JSON.' },
          { role: 'user', content: buildValuesPrompt(shorter) },
        ],
        llmConfig
      );
    }

    const compass = parseValuesCompass(raw);
    return new Response(
      JSON.stringify({ compass, trimmed }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[values] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
