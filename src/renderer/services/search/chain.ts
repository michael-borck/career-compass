import type { SearchEngine } from '@/lib/settings-store';
import type { SourceRef } from './prompt';
import { normaliseSearchFallbackOrder, type SearchSettings } from './settings';
import { isProviderConfigured, runProvider } from './providers';

const DEFAULT_LIMIT = 9;
const BREAKER_MS = 60 * 1000;

const breaker = new Map<string, number>();

// Test-only helper: breaker state is process-wide and would otherwise leak
// between tests that deliberately trigger a 429/5xx.
export function __resetSearchChainForTests(): void {
  breaker.clear();
}

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
];

export type SearchAttemptStatus = 'ok' | 'empty' | 'error' | 'skipped';

export type SearchAttempt = {
  provider: string;
  status: SearchAttemptStatus;
  count: number;
  latencyMs: number;
  error?: string;
  reason?: string;
  /** Original thrown error, kept in-process so callers can preserve it. */
  cause?: unknown;
};

export type SearchOutcome = {
  results: SourceRef[];
  attempts: SearchAttempt[];
};

export type ChainEntry = {
  name: string;
  run: ((limit: number) => Promise<SourceRef[]>) | null;
};

export function normaliseFallbackOrder(value: string | undefined): string {
  return normaliseSearchFallbackOrder(value);
}

function buildOrder(settings: SearchSettings): string[] {
  if (settings.engine === 'disabled') return [];

  const primary = settings.engine;
  const fallback =
    settings.fallbackEnabled === true
      ? normaliseSearchFallbackOrder(settings.fallbackOrder).split(',')
      : [];

  const seen = new Set<string>();
  const order: string[] = [];
  for (const name of [primary, ...fallback]) {
    if (seen.has(name)) continue;
    if (!['brave', 'serper', 'searxng', 'duckduckgo'].includes(name)) continue;
    seen.add(name);
    order.push(name);
  }
  return order;
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function normaliseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let value = url.toString();
    if (value.endsWith('/')) value = value.slice(0, -1);
    return value;
  } catch {
    return raw;
  }
}

function domainOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function mergeResults(results: SourceRef[], provider: string, limit: number): SourceRef[] {
  const seen = new Set<string>();
  const merged: SourceRef[] = [];
  for (const result of results) {
    if (!isHttpUrl(result.url)) continue;
    const key = normaliseUrl(result.url);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...result,
      domain: result.domain || domainOf(result.url),
      provider: result.provider ?? provider,
    });
    if (merged.length >= limit) break;
  }
  return merged;
}

function breakerOpen(name: string): boolean {
  const until = breaker.get(name);
  if (!until) return false;
  if (Date.now() >= until) {
    breaker.delete(name);
    return false;
  }
  return true;
}

function tripBreaker(name: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b(429|500|502|503|504)\b|timeout|aborted|fetch failed|rate limit/i.test(message)) {
    breaker.set(name, Date.now() + BREAKER_MS);
  }
}

/**
 * Run providers in order and stop at the first one that returns usable
 * results. Empty and failed providers fall through. Tests can call this
 * directly with fake entries.
 */
export async function runSearchChain(
  query: string,
  entries: ChainEntry[],
  limit = DEFAULT_LIMIT
): Promise<SearchOutcome> {
  const attempts: SearchAttempt[] = [];

  for (const entry of entries) {
    if (!entry.run) {
      attempts.push({
        provider: entry.name,
        status: 'skipped',
        count: 0,
        latencyMs: 0,
        reason: 'not configured',
      });
      continue;
    }

    if (breakerOpen(entry.name)) {
      attempts.push({
        provider: entry.name,
        status: 'skipped',
        count: 0,
        latencyMs: 0,
        reason: 'cooling down after a rate limit',
      });
      continue;
    }

    const started = Date.now();
    try {
      // Over-fetch so filtering and deduplication still leave a useful set.
      const raw = await entry.run(limit * 2);
      const results = mergeResults(raw, entry.name, limit);
      const latencyMs = Date.now() - started;
      attempts.push({
        provider: entry.name,
        status: results.length ? 'ok' : 'empty',
        count: results.length,
        latencyMs,
      });
      if (results.length) {
        breaker.delete(entry.name);
        return { results, attempts };
      }
    } catch (error) {
      const latencyMs = Date.now() - started;
      tripBreaker(entry.name, error);
      attempts.push({
        provider: entry.name,
        status: 'error',
        count: 0,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
        cause: error,
      });
    }
  }

  return { results: [], attempts };
}

/**
 * Search with the primary provider, then the configured fallback order.
 * Empty or failed providers do not stop the chain; the caller gets the
 * attempts so the UI can explain what happened.
 */
export async function searchWithFallback(
  settings: SearchSettings,
  query: string,
  options: { limit?: number } = {}
): Promise<SearchOutcome> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), 20);
  const order = buildOrder(settings);
  if (!order.length) return { results: [], attempts: [] };

  const entries: ChainEntry[] = order.map((name) => ({
    name,
    run: isProviderConfigured(name as SearchEngine, settings)
      ? (requested: number) => runProvider(name as SearchEngine, settings, query, requested)
      : null,
  }));

  return runSearchChain(query, entries, limit);
}
