import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildSkillsMappingPrompt, parseSkillsMapping, type SkillsMappingInput } from '@/lib/prompts/skills-mapping';
import { isTokenLimitError } from '@/lib/token-limit';

interface SkillsMappingRequest extends SkillsMappingInput {
  llmConfig?: LLMConfig;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as SkillsMappingRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.aboutYou && input.aboutYou.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({ error: 'A profile is required (upload a resume or write something in About you).' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    console.log('[skillsMapping] incoming:', {
      hasResume: !!input.resume,
      hasAboutYou: !!input.aboutYou,
      hasDistilledProfile: !!input.distilledProfile,
      hasJobTitle: !!input.jobTitle,
    });

    let trimmed = false;
    let raw: string;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career skills analyst that ONLY responds in JSON.' },
          { role: 'user', content: buildSkillsMappingPrompt(input) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter: SkillsMappingInput = {
        ...input,
        resume: input.resume ? input.resume.slice(0, 4000) : undefined,
      };
      raw = await provider.createCompletion(
        [
          { role: 'system', content: 'You are a career skills analyst that ONLY responds in JSON.' },
          { role: 'user', content: buildSkillsMappingPrompt(shorter) },
        ],
        llmConfig
      );
    }

    const mapping = parseSkillsMapping(raw);
    return new Response(
      JSON.stringify({ mapping, trimmed }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[skillsMapping] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
