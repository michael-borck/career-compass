import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { search, runEngineSearch, SearchError } from './service';
import { __resetCacheForTests } from './cache';
import type { SearchSettings } from './settings';

type MockOverrides = {
  storedSettings?: Record<string, unknown>;
  secureStorage?: Record<string, string | null>;
  apiFetchResponse?: {
    ok: boolean;
    status: number;
    statusText?: string;
    headers?: Record<string, string | string[]>;
    body: string;
  };
  apiFetchReject?: Error;
};

type MockElectronAPI = {
  store: { get: Mock };
  secureStorage: {
    getPassword: Mock;
    setPassword: Mock;
    deletePassword: Mock;
  };
  apiFetch: Mock;
};

function mockElectronAPI(overrides: MockOverrides = {}): MockElectronAPI {
  const storedSettings = overrides.storedSettings ?? {};
  const secureStore = overrides.secureStorage ?? {};
  const apiFetchResponse = overrides.apiFetchResponse ?? {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '',
  };

  const apiFetch = overrides.apiFetchReject
    ? vi.fn(async () => {
        throw overrides.apiFetchReject;
      })
    : vi.fn(async () => apiFetchResponse);

  const api: MockElectronAPI = {
    store: { get: vi.fn(async () => storedSettings) },
    secureStorage: {
      getPassword: vi.fn(async (key: string) => secureStore[key] ?? null),
      setPassword: vi.fn(async () => undefined),
      deletePassword: vi.fn(async () => undefined),
    },
    apiFetch,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = { electronAPI: api };
  return api;
}

beforeEach(() => {
  vi.restoreAllMocks();
  __resetCacheForTests();
});

describe('search — disabled engine', () => {
  it('returns [] without calling apiFetch', async () => {
    const api = mockElectronAPI({
      storedSettings: { searchEngine: 'disabled' },
    });
    const results = await search({ query: 'data analyst' });
    expect(results).toEqual([]);
    expect(api.apiFetch).not.toHaveBeenCalled();
  });

  it('returns [] when override settings say disabled', async () => {
    const api = mockElectronAPI();
    const settings: SearchSettings = { engine: 'disabled', apiKey: '', url: '' };
    const results = await search({ query: 'x' }, { settings });
    expect(results).toEqual([]);
    expect(api.apiFetch).not.toHaveBeenCalled();
  });
});

describe('search — Brave engine', () => {
  it('hits the Brave API with the correct headers and returns mapped sources', async () => {
    const api = mockElectronAPI({
      storedSettings: { searchEngine: 'brave' },
      secureStorage: { 'career-compass-search-brave': 'brave-key' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          web: {
            results: [
              { title: 'Glassdoor Data Analyst', url: 'https://www.glassdoor.com/x' },
              { title: 'Levels Data', url: 'https://levels.fyi/x' },
            ],
          },
        }),
      },
    });
    const results = await search({ query: 'data analyst' });
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toContain('https://api.search.brave.com/res/v1/web/search?');
    expect(call.url).toContain('q=data+analyst');
    expect(call.method).toBe('GET');
    expect(call.headers['X-Subscription-Token']).toBe('brave-key');
    expect(results).toEqual([
      { title: 'Glassdoor Data Analyst', url: 'https://www.glassdoor.com/x', domain: 'glassdoor.com' },
      { title: 'Levels Data', url: 'https://levels.fyi/x', domain: 'levels.fyi' },
    ]);
  });

  it('throws SearchError when API key is missing', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'brave' },
      // No key in secureStorage.
    });
    await expect(search({ query: 'x' })).rejects.toBeInstanceOf(SearchError);
  });

  it('throws SearchError on non-OK response', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'brave' },
      secureStorage: { 'career-compass-search-brave': 'k' },
      apiFetchResponse: {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        body: 'bad key',
      },
    });
    await expect(search({ query: 'x' })).rejects.toMatchObject({
      name: 'SearchError',
      status: 401,
    });
  });

  it('wraps network rejections as SearchError', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'brave' },
      secureStorage: { 'career-compass-search-brave': 'k' },
      apiFetchReject: new Error('ECONNREFUSED'),
    });
    await expect(search({ query: 'x' })).rejects.toMatchObject({
      name: 'SearchError',
      message: expect.stringContaining('ECONNREFUSED'),
    });
  });

  it('throws SearchError on malformed JSON', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'brave' },
      secureStorage: { 'career-compass-search-brave': 'k' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: 'not json',
      },
    });
    await expect(search({ query: 'x' })).rejects.toMatchObject({
      name: 'SearchError',
      message: expect.stringMatching(/malformed JSON/i),
    });
  });
});

describe('search — Bing engine', () => {
  it('uses Ocp-Apim-Subscription-Key header and Bing endpoint', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          webPages: {
            value: [
              { name: 'Bing Hit', url: 'https://example.com/bing' },
            ],
          },
        }),
      },
    });
    const settings: SearchSettings = { engine: 'bing', apiKey: 'bing-key', url: '' };
    const results = await search({ query: 'data analyst' }, { settings });
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toContain('api.bing.microsoft.com/v7.0/search');
    expect(call.headers['Ocp-Apim-Subscription-Key']).toBe('bing-key');
    expect(results).toEqual([
      { title: 'Bing Hit', url: 'https://example.com/bing', domain: 'example.com' },
    ]);
  });
});

describe('search — Serper engine', () => {
  it('POSTs JSON body with the query', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          organic: [
            { title: 'A', link: 'https://example.com/a' },
          ],
        }),
      },
    });
    const settings: SearchSettings = { engine: 'serper', apiKey: 'serper-key', url: '' };
    const results = await search({ query: 'data analyst' }, { settings });
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toBe('https://google.serper.dev/search');
    expect(call.method).toBe('POST');
    expect(call.headers['X-API-KEY']).toBe('serper-key');
    const body = JSON.parse(call.body);
    expect(body).toEqual({ q: 'data analyst', num: 9 });
    expect(results).toEqual([
      { title: 'A', url: 'https://example.com/a', domain: 'example.com' },
    ]);
  });
});

describe('search — SearXNG engine', () => {
  it('throws when URL is missing', async () => {
    mockElectronAPI();
    const settings: SearchSettings = { engine: 'searxng', apiKey: '', url: '' };
    await expect(search({ query: 'x' }, { settings })).rejects.toBeInstanceOf(SearchError);
  });

  it('hits the configured SearXNG instance and maps results', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          results: [
            { title: 'Result A', url: 'https://example.com/a' },
            { title: 'YouTube vid', url: 'https://youtube.com/watch?v=1' },
          ],
        }),
      },
    });
    const settings: SearchSettings = {
      engine: 'searxng',
      apiKey: '',
      url: 'https://searx.example.com',
    };
    const results = await search({ query: 'x' }, { settings });
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toContain('https://searx.example.com/search?');
    // YouTube is excluded.
    expect(results).toEqual([
      { title: 'Result A', url: 'https://example.com/a', domain: 'example.com' },
    ]);
  });
});

describe('search — caching', () => {
  it('returns cached results on second call with same query/engine', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({
          web: {
            results: [{ title: 'A', url: 'https://example.com/a' }],
          },
        }),
      },
    });
    const settings: SearchSettings = { engine: 'brave', apiKey: 'k', url: '' };
    const first = await search({ query: 'data analyst' }, { settings });
    const second = await search({ query: 'data analyst' }, { settings });
    expect(first).toEqual(second);
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('search — intent', () => {
  it('passes intent-modified query into the engine', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: JSON.stringify({ web: { results: [] } }),
      },
    });
    const settings: SearchSettings = { engine: 'brave', apiKey: 'k', url: '' };
    await search({ query: 'data analyst', intent: 'salary' }, { settings });
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toContain('site%3Aglassdoor.com');
  });
});

describe('runEngineSearch', () => {
  it('returns [] for an unknown engine via default branch', async () => {
    mockElectronAPI();
    const results = await runEngineSearch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { engine: 'no-such-engine' as any, apiKey: '', url: '' },
      'q'
    );
    expect(results).toEqual([]);
  });
});
