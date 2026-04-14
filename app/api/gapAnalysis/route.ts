import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildGapAnalysisPrompt, parseGapAnalysis, type GapAnalysisInput } from '@/lib/prompts/gaps';
import { isTokenLimitError } from '@/lib/token-limit';
import { search } from '@/lib/search-service';
import { loadSearchSettings, isSearchConfigured } from '@/lib/search-settings';
import type { SourceRef } from '@/lib/session-store';

interface GapAnalysisRequest extends GapAnalysisInput {
  llmConfig?: LLMConfig;
  grounded?: boolean;
}

const ADVERT_TRIM_CHARS = 4000;

function trimInput(input: GapAnalysisInput): GapAnalysisInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, grounded, ...input } =
      (await request.json()) as GapAnalysisRequest;

    // Defence-in-depth: landing checks first, but guard direct callers.
    const hasTarget = !!((input.jobAdvert && input.jobAdvert.trim()) || (input.jobTitle && input.jobTitle.trim()));
    const hasProfile = !!((input.resume && input.resume.trim()) || (input.aboutYou && input.aboutYou.trim()) || input.distilledProfile);
    if (!hasTarget) {
      return new Response(
        JSON.stringify({ error: 'A target is required (paste a job advert or enter a job title).' }),
        { status: 400 }
      );
    }
    if (!hasProfile) {
      return new Response(
        JSON.stringify({ error: 'A profile is required (upload a resume or write something in About you).' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    // Grounding
    let sources: SourceRef[] = [];
    let groundingFailed = false;
    const searchSettings = await loadSearchSettings();
    if (grounded && isSearchConfigured(searchSettings)) {
      try {
        const targetForSearch =
          (input.jobTitle && input.jobTitle.trim()) ||
          (input.jobAdvert && input.jobAdvert.trim().split('\n')[0].slice(0, 100)) ||
          'this role';
        const query = `${targetForSearch} salary skills requirements`;
        sources = await search({ query, intent: 'salary' });
      } catch (err) {
        console.error('[gapAnalysis] search failed:', err);
        groundingFailed = true;
        sources = [];
      }
    }

    console.log('[gapAnalysis] incoming:', {
      hasJobAdvert: !!input.jobAdvert,
      hasJobTitle: !!input.jobTitle,
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career gap analyst that ONLY responds in JSON.' },
          { role: 'user', content: buildGapAnalysisPrompt({ ...input, sources }) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = trimInput(input);
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career gap analyst that ONLY responds in JSON.' },
          { role: 'user', content: buildGapAnalysisPrompt({ ...shorter, sources }) },
        ],
        llmConfig
      );
    }

    const analysis = parseGapAnalysis(raw);
    return new Response(
      JSON.stringify({ analysis, trimmed, sources, groundingFailed }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[gapAnalysis] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
