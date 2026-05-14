// Settings loader for the search subsystem. Reads electron-store directly
// via window.electronAPI to stay independent of lib/settings-store.
//
// Storage shape matches what lib/settings-store.ts writes:
//   - 'settings' key holds { searchEngine, searchUrl, ... }
//   - secureStorage key 'career-compass-search-<engine>' holds the API key
//     for paid engines (brave, bing, serper).

export type SearchEngine =
  | 'disabled'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'serper'
  | 'searxng';

export type SearchSettings = {
  engine: SearchEngine;
  apiKey: string;
  url: string;
};

type StoredSettings = {
  searchEngine?: SearchEngine;
  searchUrl?: string;
};

/**
 * Loads search settings from electron-store and (when applicable) the
 * secure API key storage. Mirrors lib/search-settings.ts.
 */
export async function loadSearchSettings(): Promise<SearchSettings> {
  const saved = await window.electronAPI.store.get<StoredSettings>(
    'settings',
    {}
  );
  const engine = (saved?.searchEngine ?? 'duckduckgo') as SearchEngine;

  let apiKey = '';
  if (engine === 'brave' || engine === 'bing' || engine === 'serper') {
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
