import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import {
  buildCareersPrompt,
  buildCareerDetailPrompt,
  type CareersInput,
} from '@/lib/prompts/careers';

interface GetCareersRequest extends CareersInput {
  llmConfig?: LLMConfig;
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GetCareersRequest;
    const { llmConfig: clientConfig, ...input } = body;

    const llmConfig = clientConfig || (await getLLMConfig());
    console.log(
      '[getCareers] Using provider:',
      llmConfig.provider,
      'model:',
      llmConfig.model,
      'hasKey:',
      !!llmConfig.apiKey
    );

    const llmProvider = getLLMProvider(llmConfig);
    const userPrompt = buildCareersPrompt(input);

    const careers = await llmProvider.createCompletion(
      [
        {
          role: 'system',
          content: 'You are a helpful career expert that ONLY responds in JSON.',
        },
        { role: 'user', content: userPrompt },
      ],
      llmConfig
    );

    console.log('[getCareers] Initial careers response length:', careers?.length);
    const careerInfoJSON = JSON.parse(cleanJSON(careers!));

    const finalResults = await Promise.all(
      careerInfoJSON.map(async (career: any) => {
        try {
          const detailPrompt = buildCareerDetailPrompt(career, input);
          const specificCareer = await llmProvider.createCompletion(
            [
              {
                role: 'system',
                content:
                  'You are a helpful career expert that ONLY responds in JSON.',
              },
              { role: 'user', content: detailPrompt },
            ],
            llmConfig
          );
          const specificCareerJSON = JSON.parse(cleanJSON(specificCareer));
          return { ...career, ...specificCareerJSON };
        } catch (error) {
          console.error('[getCareers] Detail error for', career.jobTitle, ':', error);
          return career;
        }
      })
    );

    return new Response(JSON.stringify(finalResults), { status: 200 });
  } catch (error) {
    console.error('[getCareers] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
