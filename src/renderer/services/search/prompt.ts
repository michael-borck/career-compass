// SourceRef shape mirrors lib/session-store.ts. Kept local so the search
// service internals don't take a hard dependency on the legacy lib/ tree.
export type SourceRef = {
  title: string;
  url: string;
  domain: string;
  /** Snippet supplied by the search engine, when it has one. */
  snippet?: string;
  /** Provider that produced this result. */
  provider?: string;
  /** Rank within that provider. */
  position?: number;
};

// The citation formatters live once in lib/search-prompt.ts (also imported by
// the framework-agnostic prompt builders in lib/prompts/*). Re-exported here so
// the renderer search module keeps a single import surface and there's one
// source of truth for the <sources> prompt block.
export { formatSourcesForFootnote, formatSourcesForInlineCite } from '@/lib/search-prompt';
