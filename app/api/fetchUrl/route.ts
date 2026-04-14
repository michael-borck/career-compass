import { NextRequest } from 'next/server';
import { fetchAndExtract, UrlFetchError } from '@/lib/url-fetch';
import { classifyUrl } from '@/lib/url-classify';

interface FetchUrlRequest {
  url: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as FetchUrlRequest;
    if (!url || !url.trim()) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
      });
    }

    const result = await fetchAndExtract(url.trim());
    const classifiedAs = classifyUrl(url.trim());

    return new Response(
      JSON.stringify({
        text: result.text,
        fetchedTitle: result.title,
        domain: result.domain,
        classifiedAs,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[fetchUrl] Error:', error);
    if (error instanceof UrlFetchError) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
