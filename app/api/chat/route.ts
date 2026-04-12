import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor';
import { trimHistory } from '@/lib/chat-history';
import type { ChatMessage } from '@/lib/session-store';

interface ChatRequest {
  messages: ChatMessage[];
  currentFocus: string | null;
  llmConfig?: LLMConfig;
}

function isTokenLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (
    msg.includes('context length') ||
    msg.includes('context_length') ||
    msg.includes('maximum context') ||
    msg.includes('too many tokens') ||
    msg.includes('token limit') ||
    msg.includes('reduce the length')
  );
}

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string
) {
  // Only 'message' and 'attachment-summary' kinds get sent to the LLM.
  // Focus-markers and notices are UI-only.
  const filtered = messages.filter(
    (m) => m.kind === 'message' || m.kind === 'attachment-summary'
  );
  return [
    { role: 'system' as const, content: systemPrompt },
    ...filtered.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role,
      content:
        m.kind === 'attachment-summary'
          ? `[Attachment shared by student]\n${m.content}`
          : m.content,
    })),
  ];
}

export async function POST(request: NextRequest) {
  try {
    const { messages, currentFocus, llmConfig: clientConfig } =
      (await request.json()) as ChatRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildAdvisorSystemPrompt(currentFocus);

    let trimmed = false;
    let reply: string;

    try {
      reply = await provider.createCompletion(
        toProviderMessages(messages, systemPrompt),
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimHistory(messages, 20);
      reply = await provider.createCompletion(
        toProviderMessages(shorter, systemPrompt),
        llmConfig
      );
    }

    return new Response(JSON.stringify({ reply, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[chat] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
