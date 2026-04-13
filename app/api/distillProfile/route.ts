import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import {
  buildDistillationPrompt,
  parseDistilledProfile,
  type DistillationInput,
} from '@/lib/prompts/distill';
import { trimHistory } from '@/lib/chat-history';
import { isTokenLimitError } from '@/lib/token-limit';

interface DistillRequest extends Omit<DistillationInput, 'trimmed'> {
  llmConfig?: LLMConfig;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as DistillRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content:
              'You summarize career conversations into structured JSON profiles. Respond ONLY with JSON.',
          },
          { role: 'user', content: buildDistillationPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimHistory(input.messages, 30);
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content:
              'You summarize career conversations into structured JSON profiles. Respond ONLY with JSON.',
          },
          {
            role: 'user',
            content: buildDistillationPrompt({ ...input, messages: shorter, trimmed: true }),
          },
        ],
        llmConfig
      );
    }

    const profile = parseDistilledProfile(raw);
    return new Response(JSON.stringify({ profile, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[distillProfile] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
