// @vitest-environment jsdom
//
// lib/settings-store picks its backend from window.electronAPI at module
// load, so the mock is installed via vi.hoisted — before any import runs.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => {
  const api = {
    apiFetch: vi.fn(),
    apiFetchStream: vi.fn(),
    store: {
      get: vi.fn(
        async (): Promise<Record<string, unknown>> => ({
          provider: 'ollama',
          apiKey: '',
          baseURL: '',
          model: '',
        })
      ),
      set: vi.fn(async () => {}),
    },
  };
  (globalThis as { window?: unknown }).window ??= globalThis;
  (globalThis as any).window.electronAPI = api;
  return { api };
});

import { checkOllama, pullModel, connectOllama, RECOMMENDED_MODEL } from './ollama-setup';

type Api = typeof api;

beforeEach(() => {
  api.apiFetch.mockReset();
  api.apiFetchStream.mockReset();
  api.store.get.mockReset();
  api.store.set.mockReset();
  api.store.get.mockResolvedValue({ provider: 'ollama', apiKey: '', baseURL: '', model: '' });
  api.store.set.mockResolvedValue(undefined);
});

describe('checkOllama', () => {
  it('reports running with model names when /api/tags answers', async () => {
    const api = (window as any).electronAPI as Api;
    api.apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: JSON.stringify({ models: [{ name: 'llama3.2:3b' }, { name: 'qwen2:7b' }] }),
    });
    expect(await checkOllama()).toEqual({ running: true, models: ['llama3.2:3b', 'qwen2:7b'] });
  });

  it('reports not running on network failure or non-2xx', async () => {
    const api = (window as any).electronAPI as Api;
    api.apiFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await checkOllama()).toEqual({ running: false, models: [] });
    api.apiFetch.mockResolvedValue({ ok: false, status: 500, body: '' });
    expect(await checkOllama()).toEqual({ running: false, models: [] });
  });
});

describe('pullModel', () => {
  function streamWith(chunks: string[], response = { ok: true, status: 200, body: '' }) {
    const api = (window as any).electronAPI as Api;
    api.apiFetchStream.mockImplementation(async (_args: unknown, onChunk: (t: string) => void) => {
      for (const c of chunks) onChunk(c);
      return { ...response, statusText: '', headers: {} };
    });
    return api;
  }

  it('reports layer percentages from NDJSON, even split across chunks', async () => {
    streamWith([
      '{"status":"pulling manifest"}\n{"status":"pulling abc","total":100,"comp',
      'leted":25}\n{"status":"pulling abc","total":100,"completed":100}\n',
      '{"status":"success"}\n',
    ]);
    const seen: Array<number | null> = [];
    await pullModel(RECOMMENDED_MODEL, (p) => seen.push(p.percent));
    expect(seen).toEqual([null, 25, 100, null]);
  });

  it('rejects when the stream reports an error line', async () => {
    streamWith(['{"error":"pull model manifest: file does not exist"}\n']);
    await expect(pullModel('nope:1b', () => {})).rejects.toThrow(/file does not exist/);
  });

  it('rejects when the stream ends without success', async () => {
    streamWith(['{"status":"pulling manifest"}\n']);
    await expect(pullModel(RECOMMENDED_MODEL, () => {})).rejects.toThrow(/without confirming/);
  });

  it('rejects on a non-2xx response', async () => {
    streamWith([], { ok: false, status: 500, body: 'boom' });
    await expect(pullModel(RECOMMENDED_MODEL, () => {})).rejects.toThrow(/500/);
  });
});

describe('connectOllama', () => {
  it('writes provider, baseURL, and model while preserving other settings', async () => {
    const api = (window as any).electronAPI as Api;
    api.store.get.mockResolvedValue({
      provider: 'openai',
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4',
      searchEngine: 'brave',
    });
    await connectOllama('llama3.2:3b');
    expect(api.store.set).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({
        provider: 'ollama',
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3.2:3b',
        searchEngine: 'brave',
      })
    );
  });
});
