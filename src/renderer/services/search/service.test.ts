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

// ---------- DuckDuckGo ----------

function ddgHtml(rows: Array<{ href: string; title: string }>): string {
  // Mirrors the shape lite.duckduckgo.com returns: each result is an
  // <a class="result-link" href="...">Title</a>. The DDG regex is permissive
  // about other attributes, so we only need href, class, and inner text.
  return rows
    .map((r) => `<a href="${r.href}" class="result-link">${r.title}</a>`)
    .join('\n');
}

describe('search — DuckDuckGo engine', () => {
  it('returns mapped SourceRef[] from a 3-result HTML body (happy path)', async () => {
    const api = mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml([
          { href: 'https://example.com/a', title: 'Data analyst career path' },
          { href: 'https://example.org/b', title: 'How to become a data analyst' },
          { href: 'https://example.net/c', title: 'Data analyst salary guide 2026' },
        ]),
      },
    });
    const results = await search({ query: 'data analyst' });
    expect(api.apiFetch).toHaveBeenCalledTimes(1);
    const call = api.apiFetch.mock.calls[0][0];
    expect(call.url).toContain('lite.duckduckgo.com/lite/');
    expect(call.url).toContain('q=data+analyst');
    expect(call.method).toBe('GET');
    expect(results).toEqual([
      { title: 'Data analyst career path', url: 'https://example.com/a', domain: 'example.com' },
      { title: 'How to become a data analyst', url: 'https://example.org/b', domain: 'example.org' },
      { title: 'Data analyst salary guide 2026', url: 'https://example.net/c', domain: 'example.net' },
    ]);
  });

  it('decodes a duckduckgo.com/l/?uddg=... redirect href', async () => {
    const encoded = encodeURIComponent('https://example.com/page');
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml([
          {
            href: `//duckduckgo.com/l/?uddg=${encoded}&rut=abc123`,
            title: 'Decoded redirect result title',
          },
        ]),
      },
    });
    const results = await search({ query: 'x' });
    expect(results).toEqual([
      {
        title: 'Decoded redirect result title',
        url: 'https://example.com/page',
        domain: 'example.com',
      },
    ]);
  });

  it('filters out excluded domains (youtube.com, pinterest.com)', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml([
          { href: 'https://example.com/keep', title: 'A keepable career article' },
          { href: 'https://www.youtube.com/watch?v=1', title: 'A YouTube career video' },
          { href: 'https://pinterest.com/pin/1', title: 'A Pinterest career board' },
          { href: 'https://example.org/also-keep', title: 'Another keepable article' },
        ]),
      },
    });
    const results = await search({ query: 'x' });
    expect(results.map((r) => r.url)).toEqual([
      'https://example.com/keep',
      'https://example.org/also-keep',
    ]);
  });

  it('caps results at 9 even when 12 valid results are present', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      href: `https://example.com/r${i}`,
      title: `Result number ${i} title long enough`,
    }));
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml(rows),
      },
    });
    const results = await search({ query: 'x' });
    expect(results).toHaveLength(9);
    expect(results[0].url).toBe('https://example.com/r0');
    expect(results[8].url).toBe('https://example.com/r8');
  });

  it('drops titles 10 characters or shorter (length threshold)', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml([
          // 10 chars exactly — must be dropped (predicate is `> 10`).
          { href: 'https://example.com/short', title: 'Short Ttle' },
          // 11 chars — keep.
          { href: 'https://example.com/keep', title: 'Long Titlee' },
        ]),
      },
    });
    const results = await search({ query: 'x' });
    expect(results).toEqual([
      { title: 'Long Titlee', url: 'https://example.com/keep', domain: 'example.com' },
    ]);
  });

  it('filters out pagination links by title ("Next Page")', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml([
          { href: 'https://example.com/real', title: 'A real career article result' },
          { href: 'https://lite.duckduckgo.com/lite/?s=20', title: 'Next Page (more results)' },
        ]),
      },
    });
    const results = await search({ query: 'x' });
    expect(results.map((r) => r.title)).toEqual([
      'A real career article result',
    ]);
  });

  it('drops hrefs that do not start with http (relative or javascript:)', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: ddgHtml([
          { href: '/relative/path', title: 'A relative href result xyz' },
          { href: 'https://example.com/abs', title: 'An absolute href result xyz' },
        ]),
      },
    });
    const results = await search({ query: 'x' });
    expect(results.map((r) => r.url)).toEqual(['https://example.com/abs']);
  });

  it('throws SearchError on non-OK response', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        body: '<html>rate limited</html>',
      },
    });
    await expect(search({ query: 'x' })).rejects.toMatchObject({
      name: 'SearchError',
      status: 503,
    });
  });

  it('wraps network rejections as SearchError', async () => {
    mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchReject: new Error('ETIMEDOUT'),
    });
    await expect(search({ query: 'x' })).rejects.toMatchObject({
      name: 'SearchError',
      message: expect.stringContaining('ETIMEDOUT'),
    });
  });
});

// ---------- Timeout plumbing ----------

describe('search — timeout plumbing', () => {
  it('DuckDuckGo passes timeoutMs=10000 to apiFetch', async () => {
    const api = mockElectronAPI({
      storedSettings: { searchEngine: 'duckduckgo' },
      apiFetchResponse: { ok: true, status: 200, headers: {}, body: '' },
    });
    await search({ query: 'x' });
    expect(api.apiFetch.mock.calls[0][0].timeoutMs).toBe(10000);
  });

  it('Brave passes timeoutMs=10000 to apiFetch', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        headers: {},
        body: JSON.stringify({ web: { results: [] } }),
      },
    });
    const settings: SearchSettings = { engine: 'brave', apiKey: 'k', url: '' };
    await search({ query: 'x' }, { settings });
    expect(api.apiFetch.mock.calls[0][0].timeoutMs).toBe(10000);
  });

  it('Bing passes timeoutMs=10000 to apiFetch', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        headers: {},
        body: JSON.stringify({ webPages: { value: [] } }),
      },
    });
    const settings: SearchSettings = { engine: 'bing', apiKey: 'k', url: '' };
    await search({ query: 'x' }, { settings });
    expect(api.apiFetch.mock.calls[0][0].timeoutMs).toBe(10000);
  });

  it('Serper passes timeoutMs=10000 to apiFetch', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        headers: {},
        body: JSON.stringify({ organic: [] }),
      },
    });
    const settings: SearchSettings = { engine: 'serper', apiKey: 'k', url: '' };
    await search({ query: 'x' }, { settings });
    expect(api.apiFetch.mock.calls[0][0].timeoutMs).toBe(10000);
  });

  it('SearXNG passes timeoutMs=15000 to apiFetch (longer for self-hosted)', async () => {
    const api = mockElectronAPI({
      apiFetchResponse: {
        ok: true,
        status: 200,
        headers: {},
        body: JSON.stringify({ results: [] }),
      },
    });
    const settings: SearchSettings = {
      engine: 'searxng',
      apiKey: '',
      url: 'https://searx.example.com',
    };
    await search({ query: 'x' }, { settings });
    expect(api.apiFetch.mock.calls[0][0].timeoutMs).toBe(15000);
  });
});
