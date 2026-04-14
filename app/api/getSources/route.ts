import { NextRequest } from 'next/server';
import { search } from '@/lib/search-service';
import type { SearchIntent } from '@/lib/search-intent';

interface GetSourcesRequest {
  query: string;
  intent?: SearchIntent;
}

export async function POST(request: NextRequest) {
  try {
    const { query, intent } = (await request.json()) as GetSourcesRequest;
    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400 }
      );
    }
    const results = await search({ query: query.trim(), intent });
    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (error) {
    console.error('[getSources] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
