// Settings loader for the search subsystem. Reads electron-store directly
// via window.electronAPI to stay independent of lib/settings-store.
//
// Storage shape matches what lib/settings-store.ts writes:
//   - 'settings' key holds { searchEngine, searchUrl, searchFallback* }
//   - secureStorage keys 'career-compass-search-brave' and
//     'career-compass-search-serper' hold the API keys.

export type SearchEngine = 'disabled' | 'duckduckgo' | 'brave' | 'serper' | 'searxng';

export const SEARCH_PROVIDERS = ['brave', 'serper', 'searxng', 'duckduckgo'] as const;

export type SearchProviderName = (typeof SEARCH_PROVIDERS)[number];

export const DEFAULT_SEARCH_FALLBACK_ORDER = 'brave,serper,searxng,duckduckgo';

const VALID_ENGINES: SearchEngine[] = ['disabled', 'duckduckgo', 'brave', 'serper', 'searxng'];

// Bing's Search API was retired on 11 August 2025. A stored "bing" setting
// falls back to the free default instead of silently disabling search.
const LEGACY_SEARCH_ENGINES: Record<string, SearchEngine> = {
  bing: 'duckduckgo',
};

export function normaliseEngine(value: string | undefined): SearchEngine {
  const raw = (value ?? 'duckduckgo').toLowerCase();
  const mapped = LEGACY_SEARCH_ENGINES[raw] ?? raw;
  return VALID_ENGINES.includes(mapped as SearchEngine) ? (mapped as SearchEngine) : 'duckduckgo';
}

function isKnownProvider(name: string): name is SearchProviderName {
  return (SEARCH_PROVIDERS as readonly string[]).includes(name);
}

export function normaliseSearchFallbackOrder(value: string | undefined): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of (value ?? DEFAULT_SEARCH_FALLBACK_ORDER).split(',')) {
    const name = part.trim().toLowerCase();
    if (!isKnownProvider(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names.length ? names.join(',') : DEFAULT_SEARCH_FALLBACK_ORDER;
}

export type SearchSettings = {
  engine: SearchEngine;
  /** Legacy single key for the primary engine. */
  apiKey: string;
  url: string;
  braveApiKey?: string;
  serperApiKey?: string;
  fallbackEnabled?: boolean;
  fallbackOrder?: string;
};

type StoredSettings = {
  searchEngine?: string;
  searchUrl?: string;
  searchFallbackEnabled?: boolean;
  searchFallbackOrder?: string;
};

async function readSearchKey(engine: SearchEngine): Promise<string> {
  if (engine !== 'brave' && engine !== 'serper') return '';
  const stored = await window.electronAPI.secureStorage.getPassword(
    `career-compass-search-${engine}`
  );
  return stored ?? '';
}

/**
 * Loads search settings from electron-store and secure storage. Both Brave and
 * Serper keys are loaded so the fallback chain can use either.
 */
export async function loadSearchSettings(): Promise<SearchSettings> {
  const saved = await window.electronAPI.store.get<StoredSettings>('settings', {});
  const engine = normaliseEngine(saved?.searchEngine);
  const [braveApiKey, serperApiKey] = await Promise.all([
    readSearchKey('brave'),
    readSearchKey('serper'),
  ]);

  return {
    engine,
    apiKey: engine === 'brave' ? braveApiKey : engine === 'serper' ? serperApiKey : '',
    braveApiKey,
    serperApiKey,
    url: saved?.searchUrl ?? '',
    fallbackEnabled: saved?.searchFallbackEnabled ?? true,
    fallbackOrder: normaliseSearchFallbackOrder(saved?.searchFallbackOrder),
  };
}

/**
 * Returns true if the configured primary engine is usable — DuckDuckGo always
 * is, paid engines need an API key, SearXNG needs a URL.
 */
export function isSearchConfigured(settings: SearchSettings): boolean {
  if (settings.engine === 'disabled') return false;
  if (settings.engine === 'duckduckgo') return true;
  if (settings.engine === 'searxng') return !!settings.url.trim();
  if (settings.engine === 'brave') {
    return !!(settings.braveApiKey || settings.apiKey).trim();
  }
  if (settings.engine === 'serper') {
    return !!(settings.serperApiKey || settings.apiKey).trim();
  }
  return false;
}
