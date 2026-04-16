import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildPortfolioPrompt, type PortfolioInput } from '@/lib/prompts/portfolio';
import { isTokenLimitError } from '@/lib/token-limit';

interface PortfolioRequest extends PortfolioInput {
  llmConfig?: LLMConfig;
}

const SYSTEM =
  'You generate standalone HTML portfolio pages. Respond with ONLY HTML. No markdown, no code fences, no explanation.';

function ensureHtml(raw: string): string {
  let html = raw.trim();
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    return html;
  }
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Portfolio</title>\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as PortfolioRequest;

    const hasProfile = !!(
      (input.resume && input.resume.trim()) ||
      (input.freeText && input.freeText.trim()) ||
      input.distilledProfile
    );
    if (!hasProfile) {
      return new Response(
        JSON.stringify({ error: 'Portfolio needs a resume or About you to generate from.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;
    let current = input;

    try {
      raw = await provider.createCompletion(
        [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPortfolioPrompt(current) }],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = { ...current, jobAdvert: current.jobAdvert?.slice(0, 4000) };
      try {
        raw = await provider.createCompletion(
          [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPortfolioPrompt(current) }],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        current = { ...current, resume: current.resume?.slice(0, 4000) };
        try {
          raw = await provider.createCompletion(
            [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPortfolioPrompt(current) }],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({ error: 'Profile too long for a portfolio page. Try trimming your resume.' }),
            { status: 500 }
          );
        }
      }
    }

    const html = ensureHtml(raw!);
    const target =
      input.jobTitle?.trim() ||
      input.jobAdvert?.trim().split('\n')[0].slice(0, 60) ||
      null;

    return new Response(JSON.stringify({ html, target, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[portfolio] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    );
  }
}
