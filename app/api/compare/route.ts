import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildComparePrompt, parseComparison, type CompareInput } from '@/lib/prompts/compare';
import { isTokenLimitError } from '@/lib/token-limit';

interface CompareRequest extends CompareInput {
  llmConfig?: LLMConfig;
}

const TARGET_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimTargets(input: CompareInput): CompareInput {
  return {
    ...input,
    targets: input.targets.map((t) =>
      t.label.length > TARGET_TRIM_CHARS
        ? { ...t, label: t.label.slice(0, TARGET_TRIM_CHARS) }
        : t
    ),
  };
}

function trimResume(input: CompareInput): CompareInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM =
  'You produce structured JSON comparisons of career paths across fixed dimensions. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as CompareRequest;

    if (!Array.isArray(input.targets) || input.targets.length < 2 || input.targets.length > 3) {
      return new Response(
        JSON.stringify({ error: 'Comparison needs 2 or 3 targets.' }),
        { status: 400 }
      );
    }

    for (const t of input.targets) {
      if (!t || typeof t.label !== 'string' || !t.label.trim()) {
        return new Response(
          JSON.stringify({ error: 'Each target needs a non-empty label.' }),
          { status: 400 }
        );
      }
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;
    let current = input;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildComparePrompt(current) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = trimTargets(current);
      try {
        raw = await provider.createCompletion(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildComparePrompt(current) },
          ],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        current = trimResume(current);
        try {
          raw = await provider.createCompletion(
            [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: buildComparePrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({
              error: 'These comparisons are too long to run together. Try shorter descriptions or remove a target.',
            }),
            { status: 500 }
          );
        }
      }
    }

    const comparison = parseComparison(raw!, current);
    return new Response(JSON.stringify({ comparison, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[compare] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
