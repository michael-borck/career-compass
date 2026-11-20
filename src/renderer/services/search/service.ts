// Search dispatcher for the renderer. All network IO goes through
// window.electronAPI.apiFetch (Electron's net module in main), which
// sidesteps the browser's CORS preflight machinery and lets us call
// DuckDuckGo HTML, Brave, Serper, and SearXNG endpoints from the renderer.

import type { SourceRef } from './prompt';
import { getCached, setCached, makeKey } from './cache';
import { applyIntent, type SearchIntent } from './intent';
import { loadSearchSettings, normaliseSearchFallbackOrder, type SearchSettings } from './settings';
import { runProvider, SearchError } from './providers';
import { searchWithFallback } from './chain';

export type { SourceRef } from './prompt';
export type { SearchSettings } from './settings';
export { SearchError };
export { searchWithFallback } from './chain';
export type { SearchAttempt, SearchOutcome } from './chain';

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

/**
 * Shared search entry point. Reads settings, applies intent, checks cache,
 * runs the primary provider and then the configured fallback order.
 */
export async function search(
  input: SearchInput,
  options: SearchOptions = {}
): Promise<SourceRef[]> {
  const settings = options.settings ?? (await loadSearchSettings());
  if (settings.engine === 'disabled') return [];

  const intent = input.intent ?? 'general';
  const modifiedQuery = applyIntent(input.query, intent);

  const order =
    settings.fallbackEnabled === true
      ? normaliseSearchFallbackOrder(settings.fallbackOrder)
      : 'primary';
  const key = makeKey(`${settings.engine}|${order}`, modifiedQuery);

  const cached = getCached(key);
  if (cached) {
    console.log('[search] cache hit:', key);
    return cached;
  }

  console.log('[search] cache miss, running:', key);
  const outcome = await searchWithFallback(settings, modifiedQuery);

  if (outcome.results.length === 0) {
    const primary = outcome.attempts[0];
    if (primary?.status === 'skipped' && primary.reason === 'not configured') {
      const message =
        settings.engine === 'brave'
          ? 'Brave Search API key is required'
          : settings.engine === 'serper'
            ? 'Serper API key is required'
            : settings.engine === 'searxng'
              ? 'SearXNG URL is required'
              : 'Search provider is not configured';
      throw new SearchError(message);
    }
    const failure = outcome.attempts.find((attempt) => attempt.status === 'error');
    if (failure?.cause) throw failure.cause;
  }

  // Keep the public SourceRef shape stable for prompts, exports and tests.
  const results: SourceRef[] = outcome.results.map(({ title, url, domain }) => ({
    title,
    url,
    domain,
  }));
  setCached(key, results);
  return results;
}

/**
 * Run only the configured primary engine. Kept as the single-engine seam for
 * tests and callers that do not want fallback.
 */
export async function runEngineSearch(
  settings: SearchSettings,
  query: string
): Promise<SourceRef[]> {
  if (settings.engine === 'disabled') return [];
  const results = await runProvider(settings.engine, settings, query, 9);
  return results.map(({ title, url, domain }) => ({ title, url, domain }));
}
