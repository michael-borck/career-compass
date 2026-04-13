import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor';
import { trimHistory } from '@/lib/chat-history';
import type { ChatMessage } from '@/lib/session-store';

interface ChatRequest {
  messages: ChatMessage[];
  currentFocus: string | null;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
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

function buildContextBlock(
  resumeText?: string | null,
  freeText?: string,
  jobTitle?: string
): string | null {
  const parts: string[] = [];
  if (resumeText && resumeText.trim()) {
    parts.push(`STUDENT RESUME:\n${resumeText.trim()}`);
  }
  if (freeText && freeText.trim()) {
    parts.push(`STUDENT BACKGROUND NOTES:\n${freeText.trim()}`);
  }
  if (jobTitle && jobTitle.trim()) {
    parts.push(`JOB OF INTEREST: ${jobTitle.trim()}`);
  }
  if (parts.length === 0) return null;
  return `The student has shared the following context. Refer to it naturally when answering:\n\n${parts.join('\n\n')}`;
}

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null
) {
  // Only 'message' and 'attachment-summary' kinds get sent to the LLM.
  // Focus-markers and notices are UI-only.
  const filtered = messages.filter(
    (m) => m.kind === 'message' || m.kind === 'attachment-summary'
  );
  const out: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];
  if (contextBlock) {
    out.push({ role: 'system', content: contextBlock });
  }
  for (const m of filtered) {
    out.push({
      role: m.role === 'system' ? 'user' : m.role,
      content:
        m.kind === 'attachment-summary'
          ? `[Attachment shared by student]\n${m.content}`
          : m.content,
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
      llmConfig: clientConfig,
    } = (await request.json()) as ChatRequest;

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildAdvisorSystemPrompt(currentFocus);
    const contextBlock = buildContextBlock(resumeText, freeText, jobTitle);

    console.log('[chat] incoming:', {
      messageCount: messages?.length,
      currentFocus,
      resumeTextLen: resumeText ? resumeText.length : 0,
      freeTextLen: freeText ? freeText.length : 0,
      jobTitle: jobTitle || null,
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
