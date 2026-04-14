import { settingsStore, secureStorage, type SearchEngine } from './settings-store';

export type SearchSettings = {
  engine: SearchEngine;
  apiKey: string;
  url: string;
};

/**
 * Loads search settings from the settings store and (when applicable) the
 * secure API key storage.
 */
export async function loadSearchSettings(): Promise<SearchSettings> {
  const saved = await settingsStore.get();
  const engine = (saved.searchEngine ?? 'duckduckgo') as SearchEngine;

  let apiKey = '';
  if (engine === 'brave' || engine === 'bing' || engine === 'serper') {
    apiKey = (await secureStorage.getSearchApiKey(engine)) ?? '';
  }

  return {
    engine,
    apiKey,
    url: saved.searchUrl ?? '',
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
