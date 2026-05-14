import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { chat, LLMError } from './llm';

type MockOverrides = {
  settings?: Record<string, unknown>;
  // Map of secureStorage keyName → returned password (null falls through)
  secureStorage?: Record<string, string | null>;
  // Map of env var name → value
  envVars?: Record<string, string | null>;
  // Override the apiFetch response
  apiFetchResponse?: {
    ok: boolean;
    status: number;
    statusText?: string;
    headers?: Record<string, string | string[]>;
    body: string;
  };
};

type MockElectronAPI = {
  store: { get: Mock };
  secureStorage: {
    getPassword: Mock;
    setPassword: Mock;
    deletePassword: Mock;
  };
  getEnvVar: Mock;
  apiFetch: Mock;
};

function mockElectronAPI(overrides: MockOverrides = {}): MockElectronAPI {
  const settings = overrides.settings ?? {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4',
  };
  const secureStore = overrides.secureStorage ?? {};
  const envVars = overrides.envVars ?? {};
  const apiFetchResponse =
    overrides.apiFetchResponse ?? {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      body: JSON.stringify({
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };

  const api: MockElectronAPI = {
    store: { get: vi.fn(async () => settings) },
    secureStorage: {
      getPassword: vi.fn(async (key: string) => secureStore[key] ?? null),
      setPassword: vi.fn(async () => undefined),
      deletePassword: vi.fn(async () => undefined),
    },
    getEnvVar: vi.fn(async (name: string) => envVars[name] ?? null),
    apiFetch: vi.fn(async () => apiFetchResponse),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { electronAPI: api };
  return api;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('chat — openai', () => {
  it('constructs the correct request and parses the response', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
    });
    const result = await chat({
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.5,
      maxTokens: 500,
      response_format: { type: 'json_object' },
    });
    expect(result.content).toBe('hello');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 });

    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(call.method).toBe('POST');
    expect(call.headers.Authorization).toBe('Bearer sk-test');
    expect(call.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(call.body);
    expect(body.model).toBe('gpt-4');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(500);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('strips trailing slashes on the baseURL', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1/', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(api.apiFetch.mock.calls[0][0].url).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('falls back to OPENAI_API_KEY env var when no secureStorage key', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      envVars: { OPENAI_API_KEY: 'env-key' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(api.apiFetch.mock.calls[0][0].headers.Authorization).toBe('Bearer env-key');
  });

  it('reads legacy un-namespaced key when present', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      secureStorage: { 'career-compass-openai': 'legacy-key' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(api.apiFetch.mock.calls[0][0].headers.Authorization).toBe('Bearer legacy-key');
  });
});

describe('chat — ollama', () => {
  it('uses the configured baseURL and sends no Authorization header', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'llama3' },
    });
    const result = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.content).toBe('hello');

    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(call.headers.Authorization).toBeUndefined();
  });

  it('does not throw when no API key is set', async () => {
    mockElectronAPI({
      settings: { provider: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'llama3' },
    });
    await expect(chat({ messages: [{ role: 'user', content: 'hi' }] })).resolves.toBeDefined();
  });
});

describe('chat — groq', () => {
  it('targets the Groq OpenAI-compatible endpoint', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'groq', baseURL: '', model: 'llama-3.1-70b' },
      secureStorage: { 'career-compass-llm-groq': 'gsk-test' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(call.headers.Authorization).toBe('Bearer gsk-test');
    expect(JSON.parse(call.body).model).toBe('llama-3.1-70b');
  });
});

describe('chat — openrouter', () => {
  it('targets the OpenRouter endpoint', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openrouter', baseURL: '', model: 'anthropic/claude-3-haiku' },
      secureStorage: { 'career-compass-llm-openrouter': 'or-test' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(call.headers.Authorization).toBe('Bearer or-test');
  });
});

describe('chat — claude (Anthropic)', () => {
  it('extracts system messages into a top-level system field', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'claude', baseURL: '', model: 'claude-3-haiku-20240307' },
      secureStorage: { 'career-compass-llm-claude': 'ant-test' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          content: [{ type: 'text', text: 'hi back' }],
          usage: { input_tokens: 12, output_tokens: 7 },
        }),
      },
    });
    const result = await chat({
      messages: [
        { role: 'system', content: 'You are concise.' },
        { role: 'system', content: 'Speak like a pirate.' },
        { role: 'user', content: 'hi' },
      ],
    });
    expect(result.content).toBe('hi back');
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 7 });

    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers['x-api-key']).toBe('ant-test');
    expect(call.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(call.body);
    // System collapsed into separate field, NOT in messages
    expect(body.system).toBe('You are concise.\n\nSpeak like a pirate.');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.model).toBe('claude-3-haiku-20240307');
    expect(body.max_tokens).toBe(4096); // default
  });

  it('omits the system field when no system messages are present', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'claude', baseURL: '', model: 'claude-3-haiku-20240307' },
      secureStorage: { 'career-compass-llm-claude': 'ant-test' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }),
      },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    const body = JSON.parse(api.apiFetch.mock.calls[0][0].body);
    expect(body.system).toBeUndefined();
  });
});

describe('chat — gemini', () => {
  it('builds native generateContent request with role mapping and parses response', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'gemini', baseURL: '', model: 'gemini-1.5-flash' },
      secureStorage: { 'career-compass-llm-gemini': 'goog-test' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'gemini reply' }] } }],
          usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4 },
        }),
      },
    });
    const result = await chat({
      messages: [
        { role: 'system', content: 'Be helpful.' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'how are you?' },
      ],
    });
    expect(result.content).toBe('gemini reply');
    expect(result.usage).toEqual({ promptTokens: 8, completionTokens: 4 });

    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=goog-test'
    );
    const body = JSON.parse(call.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be helpful.' }] });
    // assistant → model role mapping
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
      { role: 'user', parts: [{ text: 'how are you?' }] },
    ]);
  });
});

describe('chat — error handling', () => {
  it('throws LLMError when apiFetch returns ok:false', async () => {
    mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
      apiFetchResponse: {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        body: '{"error":{"message":"bad key"}}',
      },
    });
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(401);
    expect((err as LLMError).body).toBe('{"error":{"message":"bad key"}}');
    expect((err as LLMError).message).toMatch(/OpenAI/);
  });

  it.each(['openai', 'claude', 'groq', 'gemini', 'openrouter'] as const)(
    'throws when no API key is configured for %s',
    async (provider) => {
      mockElectronAPI({
        settings: { provider, baseURL: '', model: 'some-model' },
      });
      await expect(
        chat({ messages: [{ role: 'user', content: 'hi' }] })
      ).rejects.toThrow(/API key not configured/i);
    }
  );
});

describe('chat — malformed JSON', () => {
  it('throws LLMError when an OpenAI-compatible provider returns non-JSON', async () => {
    mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '<html>error</html>',
      },
    });
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(200);
    expect((err as LLMError).body).toBe('<html>error</html>');
    expect((err as LLMError).message).toMatch(/OpenAI.*malformed JSON/i);
  });

  it('throws LLMError when Anthropic returns non-JSON', async () => {
    mockElectronAPI({
      settings: { provider: 'claude', baseURL: '', model: 'claude-3-haiku-20240307' },
      secureStorage: { 'career-compass-llm-claude': 'ant-test' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '<html>error</html>',
      },
    });
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(200);
    expect((err as LLMError).body).toBe('<html>error</html>');
    expect((err as LLMError).message).toMatch(/Anthropic.*malformed JSON/i);
  });

  it('throws LLMError when Gemini returns non-JSON', async () => {
    mockElectronAPI({
      settings: { provider: 'gemini', baseURL: '', model: 'gemini-1.5-flash' },
      secureStorage: { 'career-compass-llm-gemini': 'goog-test' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '<html>error</html>',
      },
    });
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(200);
    expect((err as LLMError).body).toBe('<html>error</html>');
    expect((err as LLMError).message).toMatch(/Gemini.*malformed JSON/i);
  });
});

describe('chat — network errors', () => {
  it('wraps apiFetch rejection in LLMError for OpenAI-compatible providers', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
    });
    api.apiFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(0);
    expect((err as LLMError).message).toMatch(/Network error/i);
    expect((err as LLMError).message).toMatch(/ECONNREFUSED/);
  });

  it('wraps apiFetch rejection in LLMError for Anthropic', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'claude', baseURL: '', model: 'claude-3-haiku-20240307' },
      secureStorage: { 'career-compass-llm-claude': 'ant-test' },
    });
    api.apiFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(0);
    expect((err as LLMError).message).toMatch(/Network error/i);
    expect((err as LLMError).message).toMatch(/Anthropic/);
  });

  it('wraps apiFetch rejection in LLMError for Gemini', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'gemini', baseURL: '', model: 'gemini-1.5-flash' },
      secureStorage: { 'career-compass-llm-gemini': 'goog-test' },
    });
    api.apiFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const err = await chat({ messages: [{ role: 'user', content: 'hi' }] }).catch(
      (e) => e as LLMError
    );
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).status).toBe(0);
    expect((err as LLMError).message).toMatch(/Network error/i);
    expect((err as LLMError).message).toMatch(/Gemini/);
  });
});

describe('chat — baseURL fallback', () => {
  it('empty baseURL falls back to OpenAI default endpoint', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: '', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(api.apiFetch.mock.calls[0][0].url).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('empty baseURL for ollama falls back to localhost default', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'ollama', baseURL: '', model: 'llama3' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(api.apiFetch.mock.calls[0][0].url).toBe(
      'http://localhost:11434/v1/chat/completions'
    );
  });

  it('explicit baseURL wins over provider default', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'openai', baseURL: 'https://proxy.example.com/v1', model: 'gpt-4' },
      secureStorage: { 'career-compass-llm-openai': 'sk-test' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(api.apiFetch.mock.calls[0][0].url).toBe(
      'https://proxy.example.com/v1/chat/completions'
    );
  });
});

describe('chat — custom provider', () => {
  it('uses the configured baseURL and optional API key', async () => {
    const api = mockElectronAPI({
      settings: { provider: 'custom', baseURL: 'http://localhost:8080/v1', model: 'custom-model' },
      secureStorage: { 'career-compass-llm-custom': 'cust-key' },
    });
    await chat({ messages: [{ role: 'user', content: 'hi' }] });
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('http://localhost:8080/v1/chat/completions');
    expect(call.headers.Authorization).toBe('Bearer cust-key');
  });

  it('throws when no baseURL is configured', async () => {
    mockElectronAPI({
      settings: { provider: 'custom', baseURL: '', model: 'custom-model' },
    });
    await expect(
      chat({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/server address/i);
  });
});
