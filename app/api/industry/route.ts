import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildIndustryPrompt, parseIndustryExploration, type IndustryInput } from '@/lib/prompts/industry';
import { isTokenLimitError } from '@/lib/token-limit';

interface IndustryRequest extends IndustryInput {
  llmConfig?: LLMConfig;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as IndustryRequest;

    if (!input.industry || !input.industry.trim()) {
      return new Response(
        JSON.stringify({ error: 'An industry name is required.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[industry] incoming:', {
      industry: input.industry,
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
      hasJobTitle: !!input.jobTitle,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career exploration advisor that ONLY responds in JSON.' },
          { role: 'user', content: buildIndustryPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter: IndustryInput = {
        ...input,
        resume: input.resume ? input.resume.slice(0, 4000) : undefined,
      };
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career exploration advisor that ONLY responds in JSON.' },
          { role: 'user', content: buildIndustryPrompt(shorter) },
        ],
        llmConfig
      );
    }

    const exploration = parseIndustryExploration(raw);
    return new Response(
      JSON.stringify({ exploration, trimmed }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[industry] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
