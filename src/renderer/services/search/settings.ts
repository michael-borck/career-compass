// Settings loader for the search subsystem. Reads electron-store directly
// via window.electronAPI to stay independent of lib/settings-store.
//
// Storage shape matches what lib/settings-store.ts writes:
//   - 'settings' key holds { searchEngine, searchUrl, ... }
//   - secureStorage key 'career-compass-search-<engine>' holds the API key
//     for paid engines (brave, serper).

export type SearchEngine = 'disabled' | 'duckduckgo' | 'brave' | 'serper' | 'searxng';

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

export type SearchSettings = {
  engine: SearchEngine;
  apiKey: string;
  url: string;
};

type StoredSettings = {
  searchEngine?: string;
  searchUrl?: string;
};

/**
 * Loads search settings from electron-store and (when applicable) the
 * secure API key storage. Mirrors lib/search-settings.ts.
 */
export async function loadSearchSettings(): Promise<SearchSettings> {
  const saved = await window.electronAPI.store.get<StoredSettings>('settings', {});
  const engine = normaliseEngine(saved?.searchEngine);

  let apiKey = '';
  if (engine === 'brave' || engine === 'serper') {
    const stored = await window.electronAPI.secureStorage.getPassword(
      `career-compass-search-${engine}`
    );
    apiKey = stored ?? '';
  }

  return {
    engine,
    apiKey,
    url: saved?.searchUrl ?? '',
  };
}

/**
 * Returns true if the configured engine is usable — DuckDuckGo always is,
 * paid engines need an API key, SearXNG needs a URL.
 */
export function isSearchConfigured(settings: SearchSettings): boolean {
  if (settings.engine === 'disabled') return false;
  if (settings.engine === 'duckduckgo') return true;
  if (settings.engine === 'searxng') return !!settings.url.trim();
  return !!settings.apiKey.trim();
}
