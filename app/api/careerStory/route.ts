import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildCareerStoryPrompt, parseCareerStory, type CareerStoryInput } from '@/lib/prompts/career-story';
import { isTokenLimitError } from '@/lib/token-limit';

interface CareerStoryRequest extends CareerStoryInput {
  llmConfig?: LLMConfig;
}

const SYSTEM = 'You identify career themes and write narrative career stories. You ONLY respond in JSON.';

function trimSessionOutputs(input: CareerStoryInput): CareerStoryInput {
  return {
    ...input,
    comparison: undefined,
    boardReview: undefined,
    odysseyLives: undefined,
    careers: undefined,
    gapAnalysis: undefined,
    learningPath: undefined,
    elevatorPitch: undefined,
    coverLetter: undefined,
    resumeReview: undefined,
    interviewFeedback: undefined,
    valuesCompass: undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as CareerStoryRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.freeText && input.freeText.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({ error: 'Career story needs a resume or About you to build from.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCareerStoryPrompt(input) }],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      // First trim: drop all session outputs, keep profile
      const lighter = trimSessionOutputs(input);
      try {
        raw = await provider.createCompletion(
          [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCareerStoryPrompt(lighter) }],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        // Second trim: also trim jobAdvert and resume
        const lightest = {
          ...lighter,
          jobAdvert: lighter.jobAdvert?.slice(0, 4000),
          resume: lighter.resume?.slice(0, 4000),
        };
        try {
          raw = await provider.createCompletion(
            [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCareerStoryPrompt(lightest) }],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({ error: 'Too much session data to process. Try with fewer features completed.' }),
            { status: 500 }
          );
        }
      }
    }

    const story = parseCareerStory(raw!);
    return new Response(JSON.stringify({ story, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[careerStory] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    );
  }
}
