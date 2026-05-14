// Search dispatcher for the renderer. All network IO goes through
// window.electronAPI.apiFetch (Electron's net module in main), which
// sidesteps the browser's CORS preflight machinery and lets us call
// DuckDuckGo HTML, Brave, Bing, Serper, and SearXNG endpoints from the
// renderer process.
//
// Faithful port of lib/search-service.ts — engine dispatch logic and
// per-engine request shapes are preserved. Only changes:
//   - fetch(...) replaced with window.electronAPI.apiFetch(...)
//   - JSON.parse wrapped in try/catch and surfaced as a clear error
//   - network rejections caught and wrapped as SearchError
//   - per-engine timeouts passed via apiFetch's timeoutMs (10s for most
//     engines, 15s for SearXNG which is often a slow self-hosted instance)

import type { SourceRef } from './prompt';
import { getCached, setCached, makeKey } from './cache';
import { applyIntent, type SearchIntent } from './intent';
import { loadSearchSettings, type SearchSettings } from './settings';

export type { SourceRef } from './prompt';
export type { SearchSettings } from './settings';

export type SearchInput = {
  query: string;
  intent?: SearchIntent;
};

export type SearchOptions = {
  // Optional override — if present, the service uses these settings instead
  // of reading from electron-store. Used by the Settings page test button
  // so the user's unsaved edits are honored.
  settings?: SearchSettings;
};

export class SearchError extends Error {
  status: number;
  body: string;
  constructor(message: string, status = 0, body = '') {
    super(message);
    this.name = 'SearchError';
    this.status = status;
    this.body = body;
  }
}

const EXCLUDED_SITES = ['youtube.com', 'pinterest.com', 'reddit.com/r/'];

function isExcluded(url: string, excludeList: string[]): boolean {
  return excludeList.some((site) => url.includes(site));
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function parseJsonOrThrow(
  engineLabel: string,
  resp: { status: number; body: string }
): unknown {
  try {
    return JSON.parse(resp.body);
  } catch {
    throw new SearchError(
      `${engineLabel} returned malformed JSON`,
      resp.status,
      resp.body
    );
  }
}

/**
 * Shared search entry point. Reads settings, applies intent, checks cache,
 * dispatches to the configured engine, and returns normalized SourceRef[].
 */
export async function search(
  input: SearchInput,
  options: SearchOptions = {}
): Promise<SourceRef[]> {
  const settings = options.settings ?? (await loadSearchSettings());
  if (settings.engine === 'disabled') return [];

  const intent = input.intent ?? 'general';
  const modifiedQuery = applyIntent(input.query, intent);
  const key = makeKey(settings.engine, modifiedQuery);

  const cached = getCached(key);
  if (cached) {
    console.log('[search] cache hit:', key);
    return cached;
  }

  console.log('[search] cache miss, running:', key);
  const results = await runEngineSearch(settings, modifiedQuery);
  setCached(key, results);
  return results;
}

export async function runEngineSearch(
  settings: SearchSettings,
  query: string
): Promise<SourceRef[]> {
  switch (settings.engine) {
    case 'duckduckgo':
      return runDuckDuckGo(query);
    case 'brave':
      return runBrave(query, settings.apiKey);
    case 'bing':
      return runBing(query, settings.apiKey);
    case 'serper':
      return runSerper(query, settings.apiKey);
    case 'searxng':
      return runSearxng(query, settings.url);
    default:
      return [];
  }
}

// ---------- DuckDuckGo ----------

async function runDuckDuckGo(query: string): Promise<SourceRef[]> {
  const params = new URLSearchParams({ q: query, t: 'h_', ia: 'web' });
  let response;
  try {
    response = await window.electronAPI.apiFetch({
      url: `https://lite.duckduckgo.com/lite/?${params}`,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeoutMs: 10000,
    });
  } catch (err) {
    throw new SearchError(
      `Network error contacting DuckDuckGo: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    throw new SearchError(
      `DuckDuckGo: ${response.status} ${response.statusText}`,
      response.status,
      response.body
    );
  }

  const htmlText = response.body;
  const results: SourceRef[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*class=['"]result-link['"][^>]*>([^<]+)<\/a>/gi;
  const matches = Array.from(htmlText.matchAll(linkRegex));

  for (const match of matches) {
    let url = match[1];
    const title = match[2].trim();

    if (url.includes('duckduckgo.com/l/?uddg=')) {
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        try {
          url = decodeURIComponent(uddgMatch[1]);
        } catch {
          continue;
        }
      }
    }

    if (
      url.startsWith('http') &&
      !url.includes('/?q=') &&
      !url.includes('/settings') &&
      title.length > 10 &&
      !title.toLowerCase().includes('duckduckgo') &&
      !title.toLowerCase().includes('next page') &&
      !isExcluded(url, EXCLUDED_SITES)
    ) {
      results.push({
        title: title.substring(0, 200),
        url,
        domain: extractDomain(url),
      });
      if (results.length >= 9) break;
    }
  }

  return results;
}

// ---------- Brave ----------

type BraveResult = { title: string; url: string };
type BraveResponse = { web: { results: BraveResult[] } };

async function runBrave(query: string, apiKey: string): Promise<SourceRef[]> {
  if (!apiKey) throw new SearchError('Brave Search API key is required');
  const params = new URLSearchParams({
    q: query,
    count: '9',
    text_decorations: 'false',
    search_lang: 'en',
    country: 'US',
    safesearch: 'moderate',
  });
  let response;
  try {
    response = await window.electronAPI.apiFetch({
      url: `https://api.search.brave.com/res/v1/web/search?${params}`,
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
        'User-Agent': 'CareerCompass/1.0',
      },
      timeoutMs: 10000,
    });
  } catch (err) {
    throw new SearchError(
      `Network error contacting Brave: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!response.ok) {
    throw new SearchError(
      `Brave: ${response.status} ${response.statusText}`,
      response.status,
      response.body
    );
  }
  const data = parseJsonOrThrow('Brave', response) as BraveResponse;
  return data.web.results
    .filter((r) => !isExcluded(r.url, EXCLUDED_SITES))
    .slice(0, 9)
    .map((r) => ({
      title: r.title,
      url: r.url,
      domain: extractDomain(r.url),
    }));
}

// ---------- Bing ----------

type BingResult = { name: string; url: string };
type BingResponse = { webPages: { value: BingResult[] } };

async function runBing(query: string, apiKey: string): Promise<SourceRef[]> {
  if (!apiKey) throw new SearchError('Bing API key is required');
  const params = new URLSearchParams({
    q: `${query} ${EXCLUDED_SITES.map((site) => `-site:${site}`).join(' ')}`,
    mkt: 'en-US',
    count: '9',
    safeSearch: 'Strict',
  });
  let response;
  try {
    response = await window.electronAPI.apiFetch({
      url: `https://api.bing.microsoft.com/v7.0/search?${params}`,
      method: 'GET',
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      timeoutMs: 10000,
    });
  } catch (err) {
    throw new SearchError(
      `Network error contacting Bing: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!response.ok) {
    throw new SearchError(
      `Bing: ${response.status} ${response.statusText}`,
      response.status,
      response.body
    );
  }
  const data = parseJsonOrThrow('Bing', response) as BingResponse;
  return data.webPages.value.map((r) => ({
    title: r.name,
    url: r.url,
    domain: extractDomain(r.url),
  }));
}

// ---------- Serper ----------

type SerperResult = { title: string; link: string };
type SerperResponse = { organic: SerperResult[] };

async function runSerper(query: string, apiKey: string): Promise<SourceRef[]> {
  if (!apiKey) throw new SearchError('Serper API key is required');
  let response;
  try {
    response = await window.electronAPI.apiFetch({
      url: 'https://google.serper.dev/search',
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 9 }),
      timeoutMs: 10000,
    });
  } catch (err) {
    throw new SearchError(
      `Network error contacting Serper: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!response.ok) {
    throw new SearchError(
      `Serper: ${response.status} ${response.statusText}`,
      response.status,
      response.body
    );
  }
  const data = parseJsonOrThrow('Serper', response) as SerperResponse;
  return data.organic
    .filter((r) => !isExcluded(r.link, EXCLUDED_SITES))
    .map((r) => ({
      title: r.title,
      url: r.link,
      domain: extractDomain(r.link),
    }));
}

// ---------- SearXNG ----------

type SearxngResult = { title: string; url: string; content?: string };
type SearxngResponse = { results: SearxngResult[] };

async function runSearxng(query: string, searxngUrl: string): Promise<SourceRef[]> {
  if (!searxngUrl) throw new SearchError('SearXNG URL is required');
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    category_general: '1',
    language: 'auto',
    time_range: '',
    safesearch: '2',
    theme: 'simple',
  });

  let response;
  try {
    response = await window.electronAPI.apiFetch({
      url: `${searxngUrl}/search?${params}`,
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: searxngUrl,
      },
      timeoutMs: 15000,
    });
  } catch (err) {
    throw new SearchError(
      `Network error contacting SearXNG: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    throw new SearchError(
      `SearXNG: ${response.status} ${response.statusText}`,
      response.status,
      response.body
    );
  }

  const data = parseJsonOrThrow('SearXNG', response) as SearxngResponse;
  return data.results
    .filter((r) => !isExcluded(r.url, EXCLUDED_SITES))
    .slice(0, 9)
    .map((r) => ({
      title: r.title,
      url: r.url,
      domain: extractDomain(r.url),
    }));
}
