// chatStream — provider dispatch, stream flags, SSE token delivery.

import { describe, it, expect, vi } from 'vitest';
import { chatStream, LLMError } from './llm';

type StreamMock = {
  chunks: string[];
  response?: { ok: boolean; status: number; statusText?: string; body: string };
};

function mockStreamAPI(settings: Record<string, unknown>, stream: StreamMock) {
  const apiFetchStream = vi.fn(async (_args: unknown, onChunk: (text: string) => void) => {
    const response = stream.response ?? {
      ok: true,
      status: 200,
      statusText: 'OK',
      body: '',
    };
    if (response.ok) for (const c of stream.chunks) onChunk(c);
    return { ...response, headers: {} };
  });
  (globalThis as { window?: unknown }).window = {
    electronAPI: {
      store: { get: vi.fn(async () => settings) },
      secureStorage: {
        getPassword: vi.fn(async () => 'sk-test'),
        setPassword: vi.fn(),
        deletePassword: vi.fn(),
      },
      getEnvVar: vi.fn(async () => null),
      apiFetchStream,
    },
  };
  return apiFetchStream;
}

describe('chatStream — openai-compatible', () => {
  it('sets stream:true, accumulates deltas, and reports cumulative tokens', async () => {
    const apiFetchStream = mockStreamAPI(
      { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      {
        chunks: [
          'data: {"choices":[{"delta":{"role":"assistant"}}]}\n',
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\nda',
          'ta: {"choices":[{"delta":{"content":"lo"}}]}\n',
          'data: [DONE]\n',
        ],
      }
    );
    const seen: string[] = [];
    const result = await chatStream({ messages: [{ role: 'user', content: 'hi' }] }, (t) =>
      seen.push(t)
    );
    expect(result.content).toBe('Hello');
    expect(seen).toEqual(['Hel', 'Hello']);
    const call = apiFetchStream.mock.calls[0][0] as { url: string; body: string };
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(JSON.parse(call.body).stream).toBe(true);
  });
});

describe('chatStream — ollama (native NDJSON)', () => {
  it('streams from /api/chat with think:false and accumulates message deltas', async () => {
    const apiFetchStream = mockStreamAPI(
      { provider: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'llama3' },
      {
        chunks: [
          '{"message":{"role":"assistant","content":"Hel"},"done":false}\n',
          '{"message":{"role":"assistant","content":"lo"},"done":fal',
          'se}\n',
          '{"message":{"role":"assistant","content":""},"done":true}\n',
        ],
      }
    );
    const seen: string[] = [];
    const result = await chatStream({ messages: [{ role: 'user', content: 'hi' }] }, (t) =>
      seen.push(t)
    );
    expect(result.content).toBe('Hello');
    expect(seen).toEqual(['Hel', 'Hello']);
    const call = apiFetchStream.mock.calls[0][0] as { url: string; body: string };
    expect(call.url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(call.body);
    expect(body.stream).toBe(true);
    expect(body.think).toBe(false);
  });

  it('does not surface thinking deltas as content', async () => {
    mockStreamAPI(
      {
        provider: 'ollama',
        baseURL: 'http://localhost:11434/v1',
        model: 'qwen3.5:4b',
        ollamaThink: true,
      },
      {
        chunks: [
          '{"message":{"role":"assistant","content":"","thinking":"hmm"},"done":false}\n',
          '{"message":{"role":"assistant","content":"Hi"},"done":true}\n',
        ],
      }
    );
    const result = await chatStream({ messages: [{ role: 'user', content: 'hi' }] }, () => {});
    expect(result.content).toBe('Hi');
  });
});

describe('chatStream — anthropic', () => {
  it('uses the messages endpoint with stream:true and parses content_block_delta', async () => {
    const apiFetchStream = mockStreamAPI(
      { provider: 'claude', baseURL: '', model: 'claude-test' },
      {
        chunks: [
          'event: message_start\ndata: {"type":"message_start"}\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n',
        ],
      }
    );
    const result = await chatStream({ messages: [{ role: 'user', content: 'hi' }] }, () => {});
    expect(result.content).toBe('Hi there');
    const call = apiFetchStream.mock.calls[0][0] as {
      url: string;
      body: string;
      headers: Record<string, string>;
    };
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers['x-api-key']).toBe('sk-test');
    expect(JSON.parse(call.body).stream).toBe(true);
  });
});

describe('chatStream — gemini', () => {
  it('uses streamGenerateContent with alt=sse and joins candidate parts', async () => {
    const apiFetchStream = mockStreamAPI(
      { provider: 'gemini', baseURL: '', model: 'gemini-test' },
      {
        chunks: [
          'data: {"candidates":[{"content":{"parts":[{"text":"One"}]}}]}\n',
          'data: {"candidates":[{"content":{"parts":[{"text":" two"}]}}]}\n',
        ],
      }
    );
    const result = await chatStream({ messages: [{ role: 'user', content: 'hi' }] }, () => {});
    expect(result.content).toBe('One two');
    const call = apiFetchStream.mock.calls[0][0] as { url: string };
    expect(call.url).toContain(':streamGenerateContent?alt=sse&');
  });
});

describe('chatStream — errors', () => {
  it('throws an LLMError carrying the buffered error body on non-2xx', async () => {
    mockStreamAPI(
      { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      { chunks: [], response: { ok: false, status: 429, statusText: 'Too Many', body: 'rate' } }
    );
    await expect(
      chatStream({ messages: [{ role: 'user', content: 'hi' }] }, () => {})
    ).rejects.toThrowError(LLMError);
  });
});
