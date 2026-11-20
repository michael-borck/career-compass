// Public surface of the search subsystem in the renderer.
// Mirrors what lib/search-service.ts + lib/search-intent.ts + lib/search-prompt.ts
// expose, so future page ports can swap imports with a one-line change.

export { search, runEngineSearch, searchWithFallback, SearchError } from './service';
export type {
  SearchInput,
  SearchOptions,
  SearchSettings,
  SourceRef,
  SearchAttempt,
  SearchOutcome,
} from './service';

export { applyIntent } from './intent';
export type { SearchIntent } from './intent';

export { formatSourcesForFootnote, formatSourcesForInlineCite } from './prompt';

export {
  loadSearchSettings,
  isSearchConfigured,
  normaliseSearchFallbackOrder,
  DEFAULT_SEARCH_FALLBACK_ORDER,
} from './settings';
export type { SearchEngine } from './settings';
