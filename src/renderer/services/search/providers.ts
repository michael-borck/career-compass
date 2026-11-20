// Search engine adapters. Network IO goes through
// window.electronAPI.apiFetch (Electron's net module in main), which sidesteps
// the browser's CORS machinery and lets the renderer call DuckDuckGo HTML,
// Brave, Serper, and SearXNG endpoints directly.

import type { SearchEngine } from '@/lib/settings-store';
import type { SearchSettings } from './settings';
import type { SourceRef } from './prompt';

const EXCLUDED_SITES = ['youtube.com', 'pinterest.com', 'reddit.com/r/'];

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

export function isProviderConfigured(name: SearchEngine, settings: SearchSettings): boolean {
  switch (name) {
    case 'brave':
      return Boolean(
        (settings.braveApiKey || (settings.engine === 'brave' ? settings.apiKey : '')).trim()
      );
    case 'serper':
      return Boolean(
        (settings.serperApiKey || (settings.engine === 'serper' ? settings.apiKey : '')).trim()
      );
    case 'searxng':
      return Boolean(settings.url.trim());
    case 'duckduckgo':
      return true;
    default:
      return false;
  }
}

function keyFor(name: 'brave' | 'serper', settings: SearchSettings): string {
  if (name === 'brave') {
    return settings.braveApiKey || (settings.engine === 'brave' ? settings.apiKey : '');
  }
  return settings.serperApiKey || (settings.engine === 'serper' ? settings.apiKey : '');
}

function isExcluded(url: string): boolean {
  return EXCLUDED_SITES.some((site) => url.includes(site));
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function parseJsonOrThrow(engineLabel: string, resp: { status: number; body: string }): unknown {
  try {
    return JSON.parse(resp.body);
  } catch {
    throw new SearchError(`${engineLabel} returned malformed JSON`, resp.status, resp.body);
  }
}

function requestedCount(limit: number, max: number): number {
  return Math.min(Math.max(limit, 1), max);
}

export async function runProvider(
  name: SearchEngine,
  settings: SearchSettings,
  query: string,
  limit = 9
): Promise<SourceRef[]> {
  switch (name) {
    case 'duckduckgo':
      return runDuckDuckGo(query, limit);
    case 'brave':
      return runBrave(query, keyFor('brave', settings), limit);
    case 'serper':
      return runSerper(query, keyFor('serper', settings), limit);
    case 'searxng':
      return runSearxng(query, settings.url, limit);
    default:
      return [];
  }
}

// ---------- DuckDuckGo ----------

async function runDuckDuckGo(query: string, limit: number): Promise<SourceRef[]> {
  const requested = requestedCount(limit, 30);
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
  const linkRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*class=['"]result-link['"][^>]*>([^<]+)<\/a>/gi;
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
      !isExcluded(url)
    ) {
      results.push({
        title: title.substring(0, 200),
        url,
        domain: extractDomain(url),
        position: results.length + 1,
      });
      if (results.length >= requested) break;
    }
  }

  return results;
}

// ---------- Brave ----------

type BraveResult = { title: string; url: string; description?: string };
type BraveResponse = { web: { results: BraveResult[] } };

async function runBrave(query: string, apiKey: string, limit: number): Promise<SourceRef[]> {
  if (!apiKey) throw new SearchError('Brave Search API key is required');
  const requested = requestedCount(limit, 20);
  const params = new URLSearchParams({
    q: query,
    count: String(requested),
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
    .filter((r) => !isExcluded(r.url))
    .slice(0, requested)
    .map((r, i) => ({
      title: r.title,
      url: r.url,
      domain: extractDomain(r.url),
      snippet: r.description,
      position: i + 1,
    }));
}

// ---------- Serper ----------

type SerperResult = { title: string; link: string; snippet?: string };
type SerperResponse = { organic: SerperResult[] };

async function runSerper(query: string, apiKey: string, limit: number): Promise<SourceRef[]> {
  if (!apiKey) throw new SearchError('Serper API key is required');
  const requested = requestedCount(limit, 100);
  let response;
  try {
    response = await window.electronAPI.apiFetch({
      url: 'https://google.serper.dev/search',
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: requested }),
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
    .filter((r) => !isExcluded(r.link))
    .slice(0, requested)
    .map((r, i) => ({
      title: r.title,
      url: r.link,
      domain: extractDomain(r.link),
      snippet: r.snippet,
      position: i + 1,
    }));
}

// ---------- SearXNG ----------

type SearxngResult = { title: string; url: string; content?: string };
type SearxngResponse = { results: SearxngResult[] };

async function runSearxng(query: string, searxngUrl: string, limit: number): Promise<SourceRef[]> {
  if (!searxngUrl) throw new SearchError('SearXNG URL is required');
  const requested = requestedCount(limit, 30);
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
    .filter((r) => !isExcluded(r.url))
    .slice(0, requested)
    .map((r, i) => ({
      title: r.title,
      url: r.url,
      domain: extractDomain(r.url),
      snippet: r.content,
      position: i + 1,
    }));
}
