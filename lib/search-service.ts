import type { SourceRef } from './session-store';
import { getCached, setCached, makeKey } from './search-cache';
import { applyIntent, type SearchIntent } from './search-intent';
import { loadSearchSettings, type SearchSettings } from './search-settings';

export type SearchInput = {
  query: string;
  intent?: SearchIntent;
};

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

/**
 * Shared search entry point. Reads settings, applies intent, checks cache,
 * dispatches to the configured engine, and returns normalized SourceRef[].
 */
export async function search(input: SearchInput): Promise<SourceRef[]> {
  const settings = await loadSearchSettings();
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
  const response = await fetch(`https://lite.duckduckgo.com/lite/?${params}`, {
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
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo: ${response.status} ${response.statusText}`);
  }

  const htmlText = await response.text();
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
  if (!apiKey) throw new Error('Brave Search API key is required');
  const params = new URLSearchParams({
    q: query,
    count: '9',
    text_decorations: 'false',
    search_lang: 'en',
    country: 'US',
    safesearch: 'moderate',
  });
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
        'User-Agent': 'CareerCompass/1.0',
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!response.ok) {
    throw new Error(`Brave: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as BraveResponse;
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
  if (!apiKey) throw new Error('Bing API key is required');
  const params = new URLSearchParams({
    q: `${query} ${EXCLUDED_SITES.map((site) => `-site:${site}`).join(' ')}`,
    mkt: 'en-US',
    count: '9',
    safeSearch: 'Strict',
  });
  const response = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?${params}`,
    {
      method: 'GET',
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    }
  );
  if (!response.ok) {
    throw new Error(`Bing: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as BingResponse;
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
  if (!apiKey) throw new Error('Serper API key is required');
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 9 }),
  });
  if (!response.ok) {
    throw new Error(`Serper: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as SerperResponse;
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
  if (!searxngUrl) throw new Error('SearXNG URL is required');
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    category_general: '1',
    language: 'auto',
    time_range: '',
    safesearch: '2',
    theme: 'simple',
  });

  const response = await fetch(`${searxngUrl}/search?${params}`, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: searxngUrl,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`SearXNG: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as SearxngResponse;
  return data.results
    .filter((r) => !isExcluded(r.url, EXCLUDED_SITES))
    .slice(0, 9)
    .map((r) => ({
      title: r.title,
      url: r.url,
      domain: extractDomain(r.url),
    }));
}
