import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildFeedbackPrompt, parseFeedback } from '@/lib/prompts/interview-feedback';
import { isTokenLimitError } from '@/lib/token-limit';
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewPhase,
} from '@/lib/session-store';

interface FeedbackRequest {
  messages: ChatMessage[];
  target: string;
  difficulty: InterviewDifficulty;
  reachedPhase: InterviewPhase | null;
  llmConfig?: LLMConfig;
}

const MESSAGE_TRIM_COUNT = 30;

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      target,
      difficulty,
      reachedPhase,
      llmConfig: clientConfig,
    } = (await request.json()) as FeedbackRequest;

    if (!target || !target.trim()) {
      return new Response(
        JSON.stringify({ error: 'A target is required to generate feedback.' }),
        { status: 400 }
      );
    }
    const userMessageCount = messages.filter(
      (m) => m.role === 'user' && m.kind === 'message'
    ).length;
    if (userMessageCount === 0) {
      return new Response(
        JSON.stringify({ error: 'No interview transcript to evaluate.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[interviewFeedback] incoming:', {
      target,
      difficulty,
      reachedPhase,
      messageCount: messages.length,
      userMessageCount,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content: 'You are an interview coach that ONLY responds in JSON.',
          },
          {
            role: 'user',
            content: buildFeedbackPrompt({ target, difficulty, messages, reachedPhase }),
          },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shortMessages = messages.slice(-MESSAGE_TRIM_COUNT);
      raw = await provider.createCompletion(
        [
          {
            role: 'system',
            content: 'You are an interview coach that ONLY responds in JSON.',
          },
          {
            role: 'user',
            content: `NOTE: This is the most recent portion of a longer transcript. Earlier messages were dropped to fit the token budget. Acknowledge this in your summary.\n\n${buildFeedbackPrompt({ target, difficulty, messages: shortMessages, reachedPhase })}`,
          },
        ],
        llmConfig
      );
    }

    const feedback = parseFeedback(raw);
    return new Response(JSON.stringify({ feedback, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[interviewFeedback] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
