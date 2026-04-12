import { NextRequest } from 'next/server';

interface ModelInfo {
  id: string;
  name: string;
  size?: string;
}


export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, baseURL } = await request.json();

    let models: ModelInfo[] = [];

    switch (provider) {
      case 'ollama': {
        const url = (baseURL || 'http://localhost:11434').replace(/\/v1\/?$/, '');
        const response = await fetch(`${url}/api/tags`);
        if (!response.ok) throw new Error('Ollama not reachable');
        const data = await response.json();
        models = (data.models || []).map((m: any) => ({ id: m.name, name: m.name, size: m.size }));
        break;
      }

      case 'openai': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
        const data = await response.json();
        models = (data.data || [])
          .sort((a: any, b: any) => a.id.localeCompare(b.id))
          .map((m: any) => ({ id: m.id, name: m.id }));
        break;
      }

      case 'claude': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          }
        });
        if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
        const data = await response.json();
        models = (data.data || [])
          .sort((a: any, b: any) => a.id.localeCompare(b.id))
          .map((m: any) => ({ id: m.id, name: m.id }));
        break;
      }

      case 'groq': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error(`Groq error: ${response.status}`);
        const data = await response.json();
        models = (data.data || [])
          .sort((a: any, b: any) => a.id.localeCompare(b.id))
          .map((m: any) => ({ id: m.id, name: m.id }));
        break;
      }

      case 'gemini': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
        const data = await response.json();
        models = (data.models || [])
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
          .map((m: any) => ({
            id: m.name.replace('models/', ''),
            name: m.name.replace('models/', '')
          }));
        break;
      }

      case 'openrouter': {
        if (!apiKey) throw new Error('Secret key required');
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
        const data = await response.json();
        models = (data.data || [])
          .sort((a: any, b: any) => a.id.localeCompare(b.id))
          .map((m: any) => ({ id: m.id, name: m.id }));
        break;
      }

      case 'custom': {
        if (!baseURL) throw new Error('Server address required');
        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const response = await fetch(`${baseURL}/models`, { headers });
        if (!response.ok) throw new Error(`Custom server error: ${response.status}`);
        const data = await response.json();
        models = (data.data || data.models || [])
          .sort((a: any, b: any) => (a.id || a.name || '').localeCompare(b.id || b.name || ''))
          .map((m: any) => ({ id: m.id || m.name, name: m.id || m.name }));
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), { status: 400 });
    }

    return new Response(JSON.stringify(models), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
