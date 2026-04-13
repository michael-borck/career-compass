import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildInterviewSystemPrompt } from '@/lib/prompts/interview';
import { buildContextBlock } from '@/lib/context-block';
import { nextPhase } from '@/lib/interview-phases';
import { isTokenLimitError } from '@/lib/token-limit';
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewPhase,
  StudentProfile,
} from '@/lib/session-store';

interface InterviewRequest {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  phase: InterviewPhase;
  turnInPhase: number;
  resumeText?: string | null;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile | null;
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const MESSAGE_TRIM_COUNT = 20;

function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null
) {
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
      target,
      difficulty,
      phase,
      turnInPhase,
      resumeText,
      freeText,
      jobTitle,
      jobAdvert,
      distilledProfile,
      llmConfig: clientConfig,
    } = (await request.json()) as InterviewRequest;

    if (!target || !target.trim()) {
      return new Response(
        JSON.stringify({ error: 'A target is required to start an interview.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    const systemPrompt = buildInterviewSystemPrompt({
      target,
      difficulty,
      phase,
      turnInPhase,
    });

    const fullContext = buildContextBlock(
      resumeText,
      freeText,
      jobTitle,
      jobAdvert,
      distilledProfile ?? undefined
    );

    console.log('[interview] incoming:', {
      target,
      difficulty,
      phase,
      turnInPhase,
      messageCount: messages?.length,
      hasContextBlock: !!fullContext,
    });

    let trimmed = false;
    let reply: string;

    try {
      reply = await provider.createCompletion(
        toProviderMessages(messages, systemPrompt, fullContext),
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      // First retry: trim job advert
      let trimmedJobAdvert = jobAdvert;
      if (jobAdvert && jobAdvert.length > ADVERT_TRIM_CHARS) {
        trimmedJobAdvert = jobAdvert.slice(0, ADVERT_TRIM_CHARS);
      }
      const trimmedContext = buildContextBlock(
        resumeText,
        freeText,
        jobTitle,
        trimmedJobAdvert,
        distilledProfile ?? undefined
      );

      try {
        reply = await provider.createCompletion(
          toProviderMessages(messages, systemPrompt, trimmedContext),
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        // Second retry: trim message history to last 20
        const shortMessages = messages.slice(-MESSAGE_TRIM_COUNT);
        reply = await provider.createCompletion(
          toProviderMessages(shortMessages, systemPrompt, trimmedContext),
          llmConfig
        );
      }
    }

    const next = nextPhase(phase, turnInPhase);
    return new Response(
      JSON.stringify({
        reply,
        nextPhase: next.phase,
        nextTurnInPhase: next.turnInPhase,
        isComplete: next.isComplete,
        trimmed,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[interview] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
