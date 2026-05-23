// Tests for the provider module — model listing + connection testing.
//
// Why we don't load real Electron / hit the network: these functions take a
// `fetchImpl` seam so we pass a fake fetch returning Response-shaped objects
// and assert on the per-provider request shapes and result mapping. Mirrors
// the _apiFetchWithNet(net, ...) pattern in api-fetch.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOllamaModels,
  listModels,
  testConnection,
  resolveApiKey,
} from './providers.js';

// The dev machine may have provider keys exported in its real environment
// (the app supports env-var fallback). Start every test from a clean slate so
// "missing key" assertions are deterministic; tests that need a key stub it.
beforeEach(() => {
  for (const k of [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GROQ_API_KEY',
    'GOOGLE_API_KEY',
    'OPENROUTER_API_KEY',
  ]) {
    vi.stubEnv(k, '');
  }
});

// Build a fetch-Response-like object.
function resp({ ok = true, status = 200, statusText = 'OK', json = {}, text = '' } = {}) {
  return {
    ok,
    status,
    statusText,
    json: async () => json,
    text: async () => text,
  };
}

const fetchOk = (json) => vi.fn().mockResolvedValue(resp({ json }));

afterEach(() => vi.unstubAllEnvs());

describe('getOllamaModels', () => {
  it('returns the models array on success', async () => {
    const fetchImpl = fetchOk({ models: [{ name: 'llama3' }] });
    const models = await getOllamaModels('http://localhost:11434', fetchImpl);
    expect(models).toEqual([{ name: 'llama3' }]);
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:11434/api/tags');
  });

  it('falls back to the default URL when none is given', async () => {
    const fetchImpl = fetchOk({ models: [] });
    await getOllamaModels('', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:11434/api/tags');
  });

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp({ ok: false, status: 500, statusText: 'err' }));
    await expect(getOllamaModels('http://x', fetchImpl)).rejects.toThrow('HTTP 500');
  });
});

describe('listModels', () => {
  it('ollama: strips a trailing /v1 and maps name -> {id,name,size}', async () => {
    const fetchImpl = fetchOk({ models: [{ name: 'llama3', size: 42 }] });
    const models = await listModels('ollama', { baseURL: 'http://host/v1' }, fetchImpl);
    expect(models).toEqual([{ id: 'llama3', name: 'llama3', size: 42 }]);
    expect(fetchImpl).toHaveBeenCalledWith('http://host/api/tags');
  });

  it('openai: throws without an api key', async () => {
    await expect(listModels('openai', {}, vi.fn())).rejects.toThrow('Secret key required');
  });

  it('openai: sends a bearer header and maps + sorts ids', async () => {
    const fetchImpl = fetchOk({ data: [{ id: 'b' }, { id: 'a' }] });
    const models = await listModels('openai', { apiKey: 'k' }, fetchImpl);
    expect(models).toEqual([{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }]);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer k' },
    });
  });

  it('openai: throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp({ ok: false, status: 401 }));
    await expect(listModels('openai', { apiKey: 'k' }, fetchImpl)).rejects.toThrow('OpenAI error: 401');
  });

  it('claude: sends x-api-key and anthropic-version headers', async () => {
    const fetchImpl = fetchOk({ data: [{ id: 'claude-3' }] });
    await listModels('claude', { apiKey: 'k' }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': 'k', 'anthropic-version': '2023-06-01' },
    });
  });

  it('gemini: strips the models/ prefix and passes the key in the query', async () => {
    const fetchImpl = fetchOk({ models: [{ name: 'models/gemini-pro' }] });
    const models = await listModels('gemini', { apiKey: 'k' }, fetchImpl);
    expect(models).toEqual([{ id: 'gemini-pro', name: 'gemini-pro' }]);
    expect(fetchImpl.mock.calls[0][0]).toContain('?key=k');
  });

  it('custom: throws without a baseURL, uses data.data or data.models', async () => {
    await expect(listModels('custom', {}, vi.fn())).rejects.toThrow('Server address required');
    const fetchImpl = fetchOk({ models: [{ name: 'x' }] });
    const models = await listModels('custom', { baseURL: 'http://s' }, fetchImpl);
    expect(models).toEqual([{ id: 'x', name: 'x' }]);
  });

  it('throws on an unknown provider', async () => {
    await expect(listModels('nope', {}, vi.fn())).rejects.toThrow('Unknown provider: nope');
  });

  it('falls back to the env var when config has no apiKey', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    const fetchImpl = fetchOk({ data: [] });
    await listModels('openai', {}, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer env-key' },
    });
  });

  it('openrouter: has NO env-var fallback (preserved drift vs llm.ts)', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'env-key');
    await expect(listModels('openrouter', {}, vi.fn())).rejects.toThrow('Secret key required');
  });
});

describe('testConnection', () => {
  it('ollama: reports success from the response ok flag', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp({ ok: true }));
    expect(await testConnection('ollama', {}, fetchImpl)).toEqual({ success: true, error: null });
  });

  it('openai: reports a clear error when the key is missing', async () => {
    const out = await testConnection('openai', {}, vi.fn());
    expect(out.success).toBe(false);
    expect(out.error).toContain('OPENAI_API_KEY');
  });

  it('openai: success when ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp({ ok: true }));
    expect(await testConnection('openai', { apiKey: 'k' }, fetchImpl)).toEqual({ success: true, error: null });
  });

  it('openai: surfaces the status and body on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp({ ok: false, status: 401, text: 'bad key' }));
    const out = await testConnection('openai', { apiKey: 'k' }, fetchImpl);
    expect(out).toEqual({ success: false, error: 'OpenAI API error: 401 bad key' });
  });

  it('never throws — a fetch rejection becomes a failure result', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await testConnection('openai', { apiKey: 'k' }, fetchImpl)).toEqual({
      success: false,
      error: 'network down',
    });
  });

  it('unknown provider returns a failure result', async () => {
    expect(await testConnection('nope', {}, vi.fn())).toEqual({
      success: false,
      error: 'Unknown provider: nope',
    });
  });
});

describe('resolveApiKey', () => {
  it('prefers config.apiKey over the env var', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    expect(resolveApiKey('openai', { apiKey: 'cfg' })).toBe('cfg');
  });

  it('falls back to the mapped env var', () => {
    vi.stubEnv('GROQ_API_KEY', 'g');
    expect(resolveApiKey('groq', {})).toBe('g');
  });

  it('returns undefined for providers with no env mapping (openrouter)', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'or');
    expect(resolveApiKey('openrouter', {})).toBeUndefined();
  });
});
