import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildSeedSuggestionPrompt, parseSeedSuggestion, type SeedSuggestionInput } from '@/lib/prompts/odyssey-suggest';

interface OdysseySuggestRequest extends SeedSuggestionInput {
  llmConfig?: LLMConfig;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as OdysseySuggestRequest;

    if (!input.type || !['current', 'pivot', 'wildcard'].includes(input.type)) {
      return new Response(
        JSON.stringify({ error: 'A valid life type is required.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    const raw = await provider.createCompletion(
      [
        { role: 'system', content: 'You propose concise, first-person life seeds for an Odyssey Plan exercise. You ONLY respond in JSON.' },
        { role: 'user', content: buildSeedSuggestionPrompt(input) },
      ],
      llmConfig
    );

    const suggestion = parseSeedSuggestion(raw);
    return new Response(JSON.stringify(suggestion), { status: 200 });
  } catch (error) {
    console.error('[odysseySuggest] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
