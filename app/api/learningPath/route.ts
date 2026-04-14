import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildLearningPathPrompt, parseLearningPath, type LearningPathInput } from '@/lib/prompts/learningPath';
import { isTokenLimitError } from '@/lib/token-limit';
import { search } from '@/lib/search-service';
import { loadSearchSettings, isSearchConfigured } from '@/lib/search-settings';
import type { SourceRef } from '@/lib/session-store';

interface LearningPathRequest extends LearningPathInput {
  llmConfig?: LLMConfig;
  grounded?: boolean;
}

const ADVERT_TRIM_CHARS = 4000;

function trimInput(input: LearningPathInput): LearningPathInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, grounded, ...input } =
      (await request.json()) as LearningPathRequest;

    const hasTarget = !!((input.jobAdvert && input.jobAdvert.trim()) || (input.jobTitle && input.jobTitle.trim()));
    if (!hasTarget) {
      return new Response(
        JSON.stringify({ error: 'A target is required (paste a job advert or enter a job title).' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let sources: SourceRef[] = [];
    let groundingFailed = false;
    const searchSettings = await loadSearchSettings();
    if (grounded && isSearchConfigured(searchSettings)) {
      try {
        const targetForSearch =
          (input.jobTitle && input.jobTitle.trim()) ||
          (input.jobAdvert && input.jobAdvert.trim().split('\n')[0].slice(0, 100)) ||
          'this role';
        const topGaps = input.gapAnalysis
          ? input.gapAnalysis.gaps
              .filter((g) => g.severity === 'critical')
              .slice(0, 3)
              .map((g) => g.title)
              .join(' ')
          : '';
        const query = topGaps
          ? `${targetForSearch} courses ${topGaps}`
          : `${targetForSearch} learning path courses certifications`;
        sources = await search({ query, intent: 'course' });
      } catch (err) {
        console.error('[learningPath] search failed:', err);
        groundingFailed = true;
        sources = [];
      }
    }

    console.log('[learningPath] incoming:', {
      hasJobAdvert: !!input.jobAdvert,
      hasJobTitle: !!input.jobTitle,
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
      hasGapAnalysis: !!input.gapAnalysis,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career learning-path designer that ONLY responds in JSON.' },
          { role: 'user', content: buildLearningPathPrompt({ ...input, sources }) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimInput(input);
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career learning-path designer that ONLY responds in JSON.' },
          { role: 'user', content: buildLearningPathPrompt({ ...shorter, sources }) },
        ],
        llmConfig
      );
    }

    const path = parseLearningPath(raw);
    return new Response(
      JSON.stringify({ path, trimmed, sources, groundingFailed }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[learningPath] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
