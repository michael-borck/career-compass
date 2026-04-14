import { NextRequest } from 'next/server';
import { search } from '@/lib/search-service';

interface ChatSearchRequest {
  query: string;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = (await request.json()) as ChatSearchRequest;
    if (!query || !query.trim()) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
      });
    }
    const results = await search({ query: query.trim(), intent: 'general' });
    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (error) {
    console.error('[chatSearch] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
