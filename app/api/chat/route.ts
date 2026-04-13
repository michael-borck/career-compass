import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor';
import { trimHistory } from '@/lib/chat-history';
import { isTokenLimitError } from '@/lib/token-limit';
import type { ChatMessage } from '@/lib/session-store';
import { buildContextBlock } from '@/lib/context-block';

interface ChatRequest {
  messages: ChatMessage[];
  currentFocus: string | null;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  llmConfig?: LLMConfig;
}

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null
) {
  // Only real conversation messages go to the LLM. Attachment-summary,
  // focus-marker, and notice messages are UI chrome — sending them
  // confuses the model (e.g., "[Attachment shared]" made Claude think
  // it was being handed a multimodal file it couldn't read, so it
  // refused even though the actual text was in the system prompt).
  const filtered = messages.filter((m) => m.kind === 'message');
  const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];
  if (contextBlock) {
    out.push({ role: 'system', content: contextBlock });
  }
  for (const m of filtered) {
    out.push({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      currentFocus,
      resumeText,
      freeText,
      jobTitle,
      jobAdvert,
      llmConfig: clientConfig,
    } = (await request.json()) as ChatRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildAdvisorSystemPrompt(currentFocus);
    const contextBlock = buildContextBlock(resumeText, freeText, jobTitle, jobAdvert);

    console.log('[chat] incoming:', {
      messageCount: messages?.length,
      currentFocus,
      resumeTextLen: resumeText ? resumeText.length : 0,
      freeTextLen: freeText ? freeText.length : 0,
      jobTitle: jobTitle || null,
      jobAdvertLen: jobAdvert ? jobAdvert.length : 0,
      contextBlockPresent: !!contextBlock,
    });

    let trimmed = false;
    let reply: string;

    try {
      reply = await provider.createCompletion(
        toProviderMessages(messages, systemPrompt, contextBlock),
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimHistory(messages, 20);
      reply = await provider.createCompletion(
        toProviderMessages(shorter, systemPrompt, contextBlock),
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
