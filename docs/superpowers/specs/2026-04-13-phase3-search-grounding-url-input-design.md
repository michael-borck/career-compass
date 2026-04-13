# Phase 3 — Search Grounding (F13) and URL Input (F3)

**Date:** 2026-04-13
**Status:** Design approved — ready for implementation plan
**Phase reference:** `docs/phasing-proposal.md` Phase 3

---

## Summary

Phase 3 adds web-search grounding to the existing Career Compass features and a URL input for pasting online content. Grounding retroactively improves gap analysis (real salary numbers, skill requirements), learning path (real course names and platforms), and interview role-specific questions (current role expectations). Chat gains an opt-in look-up button. The URL input lets students paste a LinkedIn job, portfolio link, or article and have its content flow into the appropriate existing input field.

The feature builds on infrastructure we already have: Study Buddy's proven 6-engine search dispatcher ports to Career Compass almost verbatim, our existing `buildContextBlock` pattern, and the settings store. It introduces one new architectural concept — grounded vs ungrounded action routes — and one new kind of prompt content — numbered source references with two citation styles.

---

## Design principles (inherited, unchanged)

- No persistence beyond settings. Sources live in the session store, in-memory only.
- Privacy-first. Search queries leave the device, but the full resume / chat content does not — only the derived query does.
- Export, don't save. Copy-as-Markdown on the result pages includes the sources and any citation markers.
- Reuse before rebuild. Port Study Buddy's search dispatcher, reuse `buildContextBlock`, extend existing prompt builders rather than writing new ones.
- Graceful degradation. When search fails, grounded features fall back to ungrounded with an honest notice rather than erroring.

---

## Architecture

### Routes

**New:**
- `app/api/getSources/route.ts` — Study Buddy's 6-engine dispatcher, ported. Adds `intent` query modifier and in-process cache.
- `app/api/fetchUrl/route.ts` — URL fetch + readability extract + classification.
- `app/api/chatSearch/route.ts` — thin wrapper around `lib/search-service.search()` used by the chat "Look this up" flow.

**Modified:**
- `app/api/gapAnalysis/route.ts` — accepts `grounded: boolean`. Runs search with `intent: 'salary'`, includes sources in the prompt with inline citation instructions, returns `sources` + `groundingFailed`.
- `app/api/learningPath/route.ts` — same pattern with `intent: 'course'` and footnote citation instructions.
- `app/api/interview/route.ts` — when `phase === 'role-specific'` AND grounding is enabled, runs search with `intent: 'general'` and query `{target} interview questions common technical behavioural`. Results fold into the system prompt with "do not cite inline" instruction. Cache re-use across the two role-specific turns is automatic via `lib/search-cache.ts`.
- `app/api/chat/route.ts` — accepts optional `searchSources: SourceRef[]`. When present, appends `formatSourcesForFootnote(sources)` as an extra system message for that turn only.

### Session store additions

```ts
// Inputs
urlInput: string;
urlFetchedTitle: string | null;

// Phase 3 outputs / grounding state
gapAnalysisSources: SourceRef[] | null;
learningPathSources: SourceRef[] | null;
interviewSources: SourceRef[];         // accumulates across role-specific turns; deduped by URL
chatSources: Record<string, SourceRef[]>;  // keyed by assistant message id — plain object so Zustand equality works cleanly

// Actions
setUrlInput: (url: string) => void;
setUrlFetchedTitle: (title: string | null) => void;
setGapAnalysisSources: (s: SourceRef[] | null) => void;
setLearningPathSources: (s: SourceRef[] | null) => void;
addInterviewSources: (s: SourceRef[]) => void;  // dedupes by URL
setChatSourcesForMessage: (messageId: string, sources: SourceRef[]) => void;
```

`SourceRef`:

```ts
export type SourceRef = {
  title: string;
  url: string;
  domain: string;
};
```

`reset()` clears all new fields. `resetInterview()` clears `interviewSources` (it's interview state) but does NOT clear the other fields.

### Settings store additions

```ts
// lib/settings-store.ts — extend SettingsConfig type
export type SearchEngine =
  | 'disabled'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'serper'
  | 'searxng';

interface SettingsConfig {
  // existing LLM fields
  provider: ...;
  model: ...;
  baseURL: ...;

  // new search fields (non-secret)
  searchEngine: SearchEngine;
  searchUrl: string;  // for searxng (not secret)
}
```

API keys for paid search engines (Brave, Bing, Serper) are NOT fields on `SettingsConfig` — they live in `safeStorage` under key names like `search-brave`, `search-bing`, `search-serper`, mirroring the Phase 1 pattern for LLM keys. The existing `secureStorage` helper in `lib/settings-store.ts` is refactored from LLM-specific to namespaced: `getKey(namespace, key)` / `setKey(namespace, key, value)` with thin convenience wrappers for both LLM and search callers. Small refactor, preserves existing LLM-key call sites.

Default on fresh install: `searchEngine: 'duckduckgo'`, `searchUrl: ''`, no API keys stored. Grounding works out of the box without student action.

### New pure modules

| Path | Responsibility |
|---|---|
| `lib/search-service.ts` | `search({ query, intent? })` — server-side helper: reads settings, applies intent, checks cache, dispatches to engine, returns `SourceRef[]`. |
| `lib/search-cache.ts` | `Map<string, CacheEntry>` with LRU eviction at 50. `getCached(key)`, `setCached(key, results)`, `makeKey(engine, query)`. |
| `lib/search-intent.ts` | `applyIntent(query, intent)` — appends site filters per intent. |
| `lib/search-prompt.ts` | `formatSourcesForFootnote(sources)` + `formatSourcesForInlineCite(sources)`. |
| `lib/citation-detect.ts` | `segmentCitations(text)` + `hasAnyCitations(text)`. |
| `lib/search-settings.ts` | `loadSearchSettings()` + `isSearchConfigured(settings)`. Server-side. |
| `lib/url-fetch.ts` | `fetchAndExtract(url)` — readability extract with timeouts, LinkedIn early-out, `UrlFetchError` class. |
| `lib/url-classify.ts` | `classifyUrl(url)` → `'jobAdvert' \| 'freeText' \| 'unknown'`. Pattern-list based. |

### Modified modules

- `lib/prompts/gaps.ts` — `buildGapAnalysisPrompt` accepts optional `sources: SourceRef[]`. When present, appends the inline-cite block.
- `lib/prompts/learningPath.ts` — `buildLearningPathPrompt` accepts optional `sources: SourceRef[]`. When present, appends the footnote block.
- `lib/prompts/interview.ts` — `buildInterviewSystemPrompt` accepts optional `sources: SourceRef[]`. When present AND phase is `role-specific`, appends a footnote block with "do not cite inline" instruction.
- `lib/markdown-export.ts` — `gapAnalysisToMarkdown`, `learningPathToMarkdown`, `interviewFeedbackToMarkdown` all accept optional `sources` and render them at the end of the markdown. Gap analysis version preserves `[n]` markers in the body as-is.
- `lib/session-store.ts` — types, fields, actions as listed above.
- `app/about/page.tsx` — one privacy bullet updated to acknowledge search traffic.
- `app/settings/page.tsx` — new "Research & Grounding" section below the existing LLM section.

### New components

- `components/results/SourcesList.tsx` — shared footnote-style source list. Props: `{ sources: SourceRef[]; compact?: boolean }`. Renders as a numbered list with external-link icons. Compact variant is smaller vertically and used under individual chat messages.
- `components/results/InlineCitation.tsx` — `[n]` superscript link. Props: `{ index: number; sources: SourceRef[] }`. Clicking scrolls to the corresponding item in the sources list via `document.getElementById('source-n')` anchoring. Non-matching indices render muted with a tooltip.
- `components/landing/UrlInputField.tsx` — landing URL field with fetch-on-blur and status chip.
- `components/chat/LookUpButton.tsx` — small "Look this up" button near the composer with an inline prompt.

### Modified components

- `components/landing/InputsZone.tsx` — adds the URL field as a full-width row above the existing 2×2 grid.
- `components/landing/ActionsZone.tsx` — gap analysis / learning path / interview actions pass `grounded: true` based on `isSearchConfigured(settings)`.
- `components/results/GapAnalysisView.tsx` — renders `<SourcesList>` at the bottom; uses `segmentCitations` to wrap `[n]` markers in `<InlineCitation>`; shows the fallback notice when sources exist but no markers are present; shows the small-model disclaimer.
- `components/results/LearningPathView.tsx` — renders `<SourcesList>` at the bottom of the page.
- `components/interview/InterviewFeedbackView.tsx` — renders `<SourcesList>` with "Sources consulted during this interview" heading when `interviewSources.length > 0`.
- `components/chat/ChatMessageList.tsx` — for each assistant message with an entry in `chatSources`, renders `<SourcesList compact />` under the bubble.
- `components/chat/ChatComposer.tsx` — adds an optional `onLookUp` prop. When provided, the composer renders a Look-up button alongside the existing send / paperclip buttons.

### Dependencies added

- `@mozilla/readability` — article content extraction.
- `jsdom` — server-side DOM for Node. Required by Readability.

Both are widely used, stable, and have no peer-dep conflicts with our Next.js 14 stack.

---

## Search Backend Port from Study Buddy

### `app/api/getSources/route.ts`

Port Study Buddy's 6-engine route verbatim (duckduckgo, brave, bing, serper, searxng, disabled), then layer three additions:

1. **`intent` query parameter** — routes through `lib/search-intent.ts` before engine-specific code.
2. **Cache lookup** — check `lib/search-cache.ts` before hitting any engine. Cache key is `engine + normalized(modifiedQuery)`.
3. **Unified result shape** — all engines return `SourceRef[]` with `{title, url, domain}`. Rename Study Buddy's `name` → `title` and derive `domain` from URL hostname.

Settings loading comes from `lib/search-settings.ts` (Career Compass's settings store wrapper), not Study Buddy's `getSettings` helper.

**Excluded sites list:** `['youtube.com', 'pinterest.com', 'reddit.com/r/']`. YouTube because video results aren't useful for the LLM, Pinterest because it's mostly images, Reddit threads because they're often low-quality for factual claims. Students can still hit these sites manually via chat look-up — we just don't feed them to the LLM automatically.

### `lib/search-intent.ts`

```ts
export type SearchIntent = 'salary' | 'course' | 'company' | 'general';

const INTENT_FILTERS: Record<Exclude<SearchIntent, 'general'>, string[]> = {
  salary: [
    'glassdoor.com', 'levels.fyi', 'seek.com.au', 'indeed.com',
    'payscale.com', 'linkedin.com/jobs',
  ],
  course: [
    'coursera.org', 'edx.org', 'udemy.com', 'linkedin.com/learning',
    'pluralsight.com', 'freecodecamp.org', 'youtube.com',
  ],
  company: [
    'linkedin.com/company', 'glassdoor.com', 'crunchbase.com',
    'wikipedia.org',
  ],
};

export function applyIntent(query: string, intent: SearchIntent): string {
  if (intent === 'general') return query;
  const sites = INTENT_FILTERS[intent];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  return `${query} (${siteFilter})`;
}
```

Note on the YouTube conflict: the global excluded sites list filters YouTube from ALL search results, but course intent includes `youtube.com` in its site filters. The filters are applied to the query; the exclusion list is applied to results. Net effect: course-intent queries will request YouTube but won't receive them. Tradeoff: simpler logic wins, we don't get YouTube courses automatically. Students can still find them via chat look-up. Fine for Phase 3.

### `lib/search-cache.ts`

```ts
type CacheEntry = {
  results: SourceRef[];
  timestamp: number;
};

const MAX_ENTRIES = 50;
const cache = new Map<string, CacheEntry>();

export function makeKey(engine: string, query: string): string {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${engine}::${normalized}`;
}

export function getCached(key: string): SourceRef[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  // LRU refresh: delete + re-insert moves to end
  cache.delete(key);
  cache.set(key, entry);
  return entry.results;
}

export function setCached(key: string, results: SourceRef[]): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { results, timestamp: Date.now() });
}
```

LRU via Map insertion order. No TTL (expire by eviction only). Module-scoped, lives for the lifetime of the Next.js process / Electron app. Dies on reload/restart, matching the no-persistence principle.

### `lib/search-service.ts`

Shared helper for server-side grounding. Callable from any route:

```ts
import { getCached, setCached, makeKey } from './search-cache';
import { applyIntent, type SearchIntent } from './search-intent';
import { loadSearchSettings } from './search-settings';
import type { SourceRef } from './session-store';

export type SearchInput = {
  query: string;
  intent?: SearchIntent;
};

export async function search(input: SearchInput): Promise<SourceRef[]> {
  const intent = input.intent ?? 'general';
  const settings = await loadSearchSettings();

  if (settings.engine === 'disabled') return [];

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
```

`runEngineSearch(settings, query)` is the per-engine dispatch logic, extracted from the 6-engine route into a reusable function. Both `app/api/getSources/route.ts` and `lib/search-service.ts` call into it. DRY.

### Graceful degradation

When search fails (network error, rate limit, engine disabled, retries exhausted), the calling route does NOT fail. It proceeds with the LLM call WITHOUT grounding and includes a notice in the response:

```ts
{ analysis: {...}, sources: [], groundingFailed: true }
```

UI surfaces this as a small notice above the sources section: *"Couldn't fetch live data for this analysis. Results below are from the model's general knowledge."*

---

## Prompt Builder Changes

### `lib/search-prompt.ts` — two formatters

```ts
import type { SourceRef } from './session-store';

/**
 * Footnote-style (B): numbered sources shown to the LLM. No inline marker
 * instructions. UI renders sources as a list at the bottom of the output.
 * Used by learning path, interview feedback, and chat look-up.
 */
export function formatSourcesForFootnote(sources: SourceRef[]): string {
  if (sources.length === 0) return '';
  const lines = sources.map(
    (s, i) => `[${i + 1}] ${s.title} (${s.domain}) — ${s.url}`
  );
  return `<sources>
The following current web sources were retrieved for this task. You may draw on them to make your answer more accurate and up-to-date. You do not need to cite them inline; they will be shown to the student as a separate list at the end.

${lines.join('\n')}
</sources>`;
}

/**
 * Inline-citation style (C): numbered sources + instruction to tag each
 * factual claim with a [n] marker. Used by gap analysis.
 */
export function formatSourcesForInlineCite(sources: SourceRef[]): string {
  if (sources.length === 0) return '';
  const lines = sources.map(
    (s, i) => `[${i + 1}] ${s.title} (${s.domain}) — ${s.url}`
  );
  return `<sources>
The following current web sources were retrieved for this task. When you state a specific factual claim that came from one of these sources (salary numbers, timelines, specific requirements), add the source number as an inline marker like [1] or [2] at the end of the claim. Only cite when the source actually supports the claim — never fabricate a citation. If a claim is general knowledge, do not add a marker.

${lines.join('\n')}
</sources>`;
}
```

### Prompt builder integration

**Gap analysis:** `buildGapAnalysisPrompt` gains optional `sources?: SourceRef[]`. When present, appends `formatSourcesForInlineCite(sources)` as a new section after `<profile>` and before the final "ONLY respond with JSON" instruction. JSON shape guide gains:

> *Where you state a factual claim supported by one of the provided sources (salary ranges, timeline estimates, specific requirements), include the source marker inline in the `why`, `summary`, or `realisticTimeline` field like `"earns $85-95k in Perth [1]"`. Use the bracket number `[n]` format exactly. Do not fabricate markers.*

`parseGapAnalysis` unchanged — `[n]` markers live inside the parsed string fields and the UI layer handles them.

**Learning path:** `buildLearningPathPrompt` gains optional `sources?: SourceRef[]`. When present, appends `formatSourcesForFootnote(sources)` to the prompt. JSON shape guide unchanged. The LLM is told to use sources for verifying course names but not to mark them inline.

**Interview:** `buildInterviewSystemPrompt` gains optional `sources?: SourceRef[]`. When present AND `phase === 'role-specific'`, appends `formatSourcesForFootnote(sources)` with a modified instruction:

> *The following current sources were retrieved to help you ask grounded role-specific questions. Use them to understand what the role actually requires today. Do NOT mention the sources or cite them in your questions — just let them inform what you ask.*

Sources are never surfaced during chat (breaks immersion). They're collected in `store.interviewSources` for the feedback panel.

**Chat:** `lib/prompts/advisor.ts` is unchanged. When the student triggers a look-up, the chat route builds a one-off context block with `formatSourcesForFootnote(sources)` that gets injected only for that turn.

### UI detection of inline citations

`lib/citation-detect.ts`:

```ts
export type CitationSegment =
  | { kind: 'text'; value: string }
  | { kind: 'cite'; index: number };

/**
 * Splits a string into text and citation segments. A citation is any
 * [<positive integer>] occurrence.
 */
export function segmentCitations(text: string): CitationSegment[] {
  const regex = /\[(\d+)\]/g;
  const segments: CitationSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ kind: 'cite', index: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function hasAnyCitations(text: string): boolean {
  return /\[\d+\]/.test(text);
}
```

Used by `GapAnalysisView` to wrap `[n]` markers in clickable `<InlineCitation>` components.

### Fallback safety net for inline citations

Small or local models sometimes skip `[n]` markers. Detection:

```ts
const hasAnySources = gapAnalysisSources && gapAnalysisSources.length > 0;
const hasAnyMarkers =
  hasAnyCitations(analysis.summary) ||
  analysis.gaps.some(
    (g) => hasAnyCitations(g.why) || hasAnyCitations(g.targetLevel)
  ) ||
  hasAnyCitations(analysis.realisticTimeline);

const showFallbackNotice = hasAnySources && !hasAnyMarkers;
```

When true, `GapAnalysisView` renders a fallback notice at the top of the sources section:

> *The AI didn't tag specific claims with citation markers — the sources used for this analysis are listed below for your reference.*

Sources render as a plain footnote list (behavior B) in this case. Same list, different framing.

---

## URL Input (F3)

### `lib/url-classify.ts`

```ts
export type UrlClassification = 'jobAdvert' | 'freeText' | 'unknown';

type Pattern = {
  classify: UrlClassification;
  match: (hostname: string, path: string) => boolean;
};

const PATTERNS: Pattern[] = [
  // Job postings
  { classify: 'jobAdvert', match: (h, p) => h.includes('seek.com') },
  { classify: 'jobAdvert', match: (h, p) => h.includes('indeed.com') },
  { classify: 'jobAdvert', match: (h, p) => h.includes('linkedin.com') && p.includes('/jobs/') },
  { classify: 'jobAdvert', match: (h, p) => h.includes('glassdoor.com') && p.includes('/Job') },
  { classify: 'jobAdvert', match: (h, p) => h.includes('workable.com') },
  { classify: 'jobAdvert', match: (h, p) => h.includes('greenhouse.io') },
  { classify: 'jobAdvert', match: (h, p) => h.includes('lever.co') },
  // Profile / portfolio
  { classify: 'freeText', match: (h, p) => h.includes('linkedin.com') && p.includes('/in/') },
  { classify: 'freeText', match: (h, p) => h.includes('github.com') },
  { classify: 'freeText', match: (h, p) => h.includes('about.me') },
  { classify: 'freeText', match: (h, p) => h.includes('notion.site') },
  { classify: 'freeText', match: (h, p) => h.endsWith('.carrd.co') },
];

export function classifyUrl(rawUrl: string): UrlClassification {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    for (const p of PATTERNS) {
      if (p.match(hostname, path)) return p.classify;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
```

Unknown URLs default to `jobAdvert` at the action-routing layer (target-focused default).

### `lib/url-fetch.ts`

```ts
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export type FetchResult = {
  text: string;
  title: string;
  domain: string;
};

const TIMEOUT_MS = 10000;
const MAX_BYTES = 2_000_000;

export class UrlFetchError extends Error {
  constructor(
    message: string,
    public code: 'invalid' | 'timeout' | 'linkedin-blocked' | 'network' | 'no-content'
  ) {
    super(message);
  }
}

export async function fetchAndExtract(rawUrl: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlFetchError('Invalid URL', 'invalid');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlFetchError('URL must use http or https', 'invalid');
  }

  // LinkedIn profile pages aggressively block non-logged-in fetches.
  if (
    url.hostname.includes('linkedin.com') &&
    url.pathname.includes('/in/')
  ) {
    throw new UrlFetchError(
      'LinkedIn profiles require being logged in. Copy your profile text and paste it into "About you" manually.',
      'linkedin-blocked'
    );
  }

  let response: Response;
  try {
    response = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      throw new UrlFetchError('The page took too long to respond.', 'timeout');
    }
    throw new UrlFetchError(`Could not fetch the URL: ${err.message}`, 'network');
  }

  if (!response.ok) {
    throw new UrlFetchError(
      `The page returned ${response.status} ${response.statusText}.`,
      'network'
    );
  }

  const html = await response.text();
  if (html.length > MAX_BYTES) {
    throw new UrlFetchError('Page too large to extract', 'no-content');
  }

  const dom = new JSDOM(html, { url: rawUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.trim().length < 100) {
    throw new UrlFetchError(
      'Could not extract meaningful text from the page. Try copying the content manually.',
      'no-content'
    );
  }

  return {
    text: article.textContent.trim(),
    title: article.title ?? url.hostname,
    domain: url.hostname.replace(/^www\./, ''),
  };
}
```

Notes:
- `@mozilla/readability` is the same library Firefox Reader View uses. Reliable for article-like pages.
- `jsdom` is standard server-side DOM. No lighter alternative plays well with Readability.
- LinkedIn profile early-out is honest about a known limitation instead of producing garbage.
- 10-second timeout + 2 MB cap prevent hanging on slow / huge pages.

### `app/api/fetchUrl/route.ts`

```ts
import { NextRequest } from 'next/server';
import { fetchAndExtract, UrlFetchError } from '@/lib/url-fetch';
import { classifyUrl } from '@/lib/url-classify';

interface FetchUrlRequest {
  url: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as FetchUrlRequest;
    if (!url || !url.trim()) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
      });
    }

    const result = await fetchAndExtract(url.trim());
    const classifiedAs = classifyUrl(url.trim());

    return new Response(
      JSON.stringify({
        text: result.text,
        fetchedTitle: result.title,
        domain: result.domain,
        classifiedAs,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[fetchUrl] Error:', error);
    if (error instanceof UrlFetchError) {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

### `components/landing/UrlInputField.tsx`

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSessionStore } from '@/lib/session-store';

export default function UrlInputField() {
  const store = useSessionStore();
  const [url, setUrl] = useState(store.urlInput);
  const [fetching, setFetching] = useState(false);
  const [fetchedInto, setFetchedInto] = useState<'jobAdvert' | 'freeText' | null>(null);
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(store.urlFetchedTitle);

  async function handleBlur() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed === store.urlInput && store.urlFetchedTitle) return;

    setFetching(true);
    try {
      const res = await fetch('/api/fetchUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not fetch that URL');
      }
      const { text, fetchedTitle: title, classifiedAs } = await res.json() as {
        text: string;
        fetchedTitle: string;
        classifiedAs: 'jobAdvert' | 'freeText' | 'unknown';
      };

      // Unknown defaults to jobAdvert (target-focused)
      const target: 'jobAdvert' | 'freeText' =
        classifiedAs === 'freeText' ? 'freeText' : 'jobAdvert';

      if (target === 'jobAdvert') {
        store.setJobAdvert(text);
      } else {
        store.setFreeText(text);
      }
      store.setUrlInput(trimmed);
      store.setUrlFetchedTitle(title);
      setFetchedInto(target);
      setFetchedTitle(title);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not fetch URL');
    } finally {
      setFetching(false);
    }
  }

  function handleClear() {
    setUrl('');
    setFetchedInto(null);
    setFetchedTitle(null);
    store.setUrlInput('');
    store.setUrlFetchedTitle(null);
    // Do NOT clear target field content — student may have edited it.
  }

  return (
    <div className='w-full'>
      <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
        URL (optional)
      </label>
      <div className='relative'>
        <LinkIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-quiet' />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleBlur}
          placeholder='Paste a LinkedIn job, portfolio URL, or job posting'
          className='pl-9'
        />
        {fetching && (
          <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-quiet animate-spin' />
        )}
      </div>
      {fetchedTitle && fetchedInto && (
        <div className='mt-1 flex items-center gap-2 text-[var(--text-xs)] text-ink-muted italic'>
          <span>
            Fetched <strong className='not-italic'>{fetchedTitle}</strong> → added to{' '}
            {fetchedInto === 'jobAdvert' ? 'Job advert' : 'About you'}
          </span>
          <button
            type='button'
            onClick={handleClear}
            className='text-ink-quiet hover:text-ink'
            aria-label='Clear fetched URL'
          >
            <X className='w-3 h-3' />
          </button>
        </div>
      )}
    </div>
  );
}
```

### Landing layout

The URL field becomes a full-width row above the existing 2×2 grid in `InputsZone`. Visual hierarchy:

```
HERO
OUTPUTS BANNER (if state exists)

URL (full width, optional)

RESUME (left, full height) | JOB TITLE
                           | ABOUT YOU
                           | JOB ADVERT

[ ACTIONS ROW ]
```

A full-width URL field reads as "optional shortcut" rather than a peer input.

---

## Feature-Level Grounding

### Gap analysis (inline citations, style C)

**Trigger:** `grounded: true` in the request body. Client sends it whenever the configured search engine is not `disabled`.

**Search call:** one call, intent `salary`, query `${target} salary skills requirements`. For job-advert targets, a small helper extracts a role-name-looking phrase from the first 100 chars of the advert; if extraction fails, falls back to the whole first line.

**Prompt integration:** `buildGapAnalysisPrompt` receives `sources`. When non-empty, `formatSourcesForInlineCite(sources)` appends after `<profile>`. The JSON shape guide gains the inline marker instruction.

**Response shape:** `{ analysis, trimmed, sources, groundingFailed }`.

**Rendering:** `GapAnalysisView` reads `analysis` and `gapAnalysisSources` from the store. Uses `segmentCitations` to wrap `[n]` markers in `<InlineCitation>`. Clicking a marker scrolls to the sources list at the bottom. If `hasAnyCitations` returns false across all fields AND sources is non-empty, shows the fallback notice and renders sources as a plain footnote list.

Small-model disclaimer (always shown when sources exist):

> *AI-cited sources. Small or local models may occasionally misattribute a claim — click through to verify anything you plan to act on.*

### Learning path (footnote list, style B)

**Trigger:** same mechanism.

**Search call:** one call, intent `course`. Query:

```ts
const query = `${target} learning path courses certifications`;
```

When the request includes a `gapAnalysis` chain seed, we augment with the top-severity gaps:

```ts
const topGaps = gapAnalysis.gaps
  .filter(g => g.severity === 'critical')
  .slice(0, 3)
  .map(g => g.title)
  .join(' ');
const query = `${target} courses ${topGaps}`;
```

**Prompt integration:** `buildLearningPathPrompt` appends `formatSourcesForFootnote(sources)`. JSON shape guide unchanged.

**Response shape:** `{ path, trimmed, sources, groundingFailed }`.

**Rendering:** `LearningPathView` renders `<SourcesList>` at the bottom of the page, between the portfolio project box and the chain buttons.

### Interview role-specific phase (footnote, invisible during chat)

**Trigger:** inside `/api/interview` route, when `phase === 'role-specific'` AND grounding is enabled. Fires on every role-specific turn; the second turn hits the in-process cache for zero cost.

**Search call:** one call per route invocation (cached after first), intent `general`:

```ts
const query = `${target} interview questions common technical behavioural`;
```

**Prompt integration:** `buildInterviewSystemPrompt` appends `formatSourcesForFootnote(sources)` with the "do NOT cite" instruction. Only on `role-specific` phase; other phases skip it entirely.

**Response shape:** `{ reply, nextPhase, nextTurnInPhase, isComplete, trimmed, sources, groundingFailed }`.

**Client-side:** `InterviewChat.handleSend` reads `sources` and, if non-empty, calls `store.addInterviewSources(sources)` which dedupes by URL.

**Rendering:** NEVER shown during chat. `InterviewFeedbackView` adds a new "Sources consulted during this interview" section with a shared `<SourcesList>`, placed below "Next steps" and above the action button row. If `interviewSources.length === 0`, the section doesn't render.

### Chat opt-in look-up (footnote under one message)

**Trigger:** student clicks "Look this up" button next to the composer. Small inline prompt appears: *"What should I look up?"* pre-filled with a heuristic suggestion (top noun phrase from the last assistant message). Student edits, submits.

**Flow:**
1. Client fires `POST /api/chatSearch { query }` → returns `SourceRef[]`.
2. Client calls `/api/chat` as normal, but includes `searchSources` in the request body.
3. Chat route appends `formatSourcesForFootnote(searchSources)` as an extra system message for that turn only.
4. Assistant reply stored in `chatMessages` as usual.
5. Sources stored in `store.chatSources` keyed by the new assistant message's id via `setChatSourcesForMessage(messageId, sources)`.

**Rendering:** `ChatMessageList` checks `chatSources[message.id]` for each assistant message. If present, renders `<SourcesList compact />` under the bubble.

### Summary table

| Feature | Search trigger | Intent | Citation style | Where sources render | Default |
|---|---|---|---|---|---|
| Find my careers | never | — | — | — | no |
| Gap analysis | action run | `salary` | inline `[n]` | bottom of `/gap-analysis` + inline markers | yes (unless disabled) |
| Learning path | action run | `course` | footnote | bottom of `/learning-path` | yes (unless disabled) |
| Interview (role-specific only) | first role-specific turn (cached second) | `general` | invisible in chat, footnote in feedback | bottom of `InterviewFeedbackView` | yes (unless disabled) |
| Chat | student clicks "Look this up" | `general` | footnote under one message | under the assistant message that used them | no (opt-in only) |

**Global kill switch:** `searchEngine === 'disabled'` skips all search entirely. No API calls, no sources, no `groundingFailed` flag. UI shows no sources sections and no small-model disclaimer.

---

## Settings UI

### New "Research & Grounding" section on `app/settings/page.tsx`

Below the existing LLM preferences section. Same visual pattern — editorial rule, heading, radio group, conditional sub-fields.

```
PREFERENCES (existing — LLM provider)

──────────────────────────────────────────

RESEARCH & GROUNDING

Search engine
  ( ) Disabled — no web search
  (•) DuckDuckGo — free, no setup required (default)
  ( ) Brave Search — free tier 2000/month, needs API key
  ( ) Bing — paid, needs API key
  ( ) Serper (Google) — paid, needs API key
  ( ) SearXNG — self-hosted, needs URL

  [conditional: API key field for brave / bing / serper]
  [conditional: URL field for searxng]

  [Test search]

Privacy note
  Search queries leave your device. Career Compass never sends
  your resume or chat content to the search engine — only the
  derived query (e.g., "Data Analyst Perth salary").
```

### Settings store extension

`lib/settings-store.ts` — extend `SettingsConfig`:

```ts
export type SearchEngine =
  | 'disabled'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'serper'
  | 'searxng';

interface SettingsConfig {
  provider: ...;
  model: ...;
  baseURL: ...;
  searchEngine: SearchEngine;
  searchUrl: string;
}
```

API keys via `safeStorage`. Refactor `secureStorage` to namespaced `getKey(namespace, key)` / `setKey(namespace, key, value)`. Preserve existing LLM-key callers with thin convenience wrappers.

Defaults on fresh install: `searchEngine: 'duckduckgo'`, empty URL, no keys. Grounding works out of the box.

### "Test search" button

Runs a fixed query (`"career compass test query"`) through `lib/search-service.search()`. Toasts success with engine name and result count, or the error message on failure. Mirrors the existing "Test connection" button for LLM providers.

### Privacy framing

Two lines of copy under the radio group:

1. *Search queries leave your device.*
2. *Career Compass never sends your resume or chat content to the search engine — only the derived query.*

### About page update

`app/about/page.tsx` — one bullet updated:

**Before:**
> - No data collection. Your files are processed entirely on your device.

**After:**
> - No data collection. Your files are processed entirely on your device. The only outbound traffic is to your configured AI provider and, if enabled, your configured search engine. Search queries are derived from your inputs, never the full text.

---

## Error handling

**Search failures.** Try grounded, fall back to ungrounded with a notice. No hard failures from search.

- Network error / engine down / rate limit → `sources: []`, `groundingFailed: true`, UI shows fallback notice
- DuckDuckGo scrape returns zero results → same
- API key invalid → same, plus one-time toast linking to Settings
- SearXNG URL unreachable → same, toast links to Settings
- Partial retries exhausted → caught, graceful fallback

The `groundingFailed` flag sits alongside `trimmed` on each response.

**URL fetch failures.** Five distinct cases via `UrlFetchError`:

| Code | Toast |
|---|---|
| `invalid` | "That doesn't look like a valid URL." |
| `timeout` | "The page took too long to respond. Try again or paste the content manually." |
| `linkedin-blocked` | "LinkedIn profiles require being logged in. Copy your profile text and paste it into About you manually." |
| `network` | "The page returned 403. It may be blocking automated access — try pasting content manually." |
| `no-content` | "Couldn't extract meaningful text from that page. Try pasting content manually." |

In all cases, the URL field keeps its value and no content is written to the target fields.

**Citation parse failures.** Malformed markers (`[abc]`, unclosed brackets) are treated as plain text by the regex. Indices pointing to non-existent sources render as muted non-clickable markers with a tooltip: *"Source not found."*

**Missing search settings.** `isSearchConfigured()` returns false → route runs ungrounded with no error. Disabled is a legitimate user choice.

**No LLM provider configured.** Same as Phases 1/2 — toast + redirect to `/settings`.

---

## Testing

### Unit tests (Vitest)

- **`lib/search-intent.test.ts`** — `applyIntent` for each of the four intents. `general` returns unchanged. Three filtered intents produce correct site filter syntax. Edge cases: empty query, query with existing `site:` directives.
- **`lib/search-cache.test.ts`** — `getCached` / `setCached` / `makeKey`. LRU eviction at 50. Normalization (lowercase, trim, whitespace collapse) makes similar queries hit the same key. Cache hit refreshes LRU position.
- **`lib/search-prompt.test.ts`** — `formatSourcesForFootnote` and `formatSourcesForInlineCite`. Empty input returns empty string. Non-empty produces numbered list with titles, domains, URLs. Inline-cite version includes the inline marker instruction.
- **`lib/citation-detect.test.ts`** — `segmentCitations` for: plain text, one marker, multiple markers, only markers, nested brackets. `hasAnyCitations` returns correct boolean.
- **`lib/url-classify.test.ts`** — each pattern tested with a representative URL. Unknown URLs return `unknown`. Malformed URLs return `unknown` without throwing.
- **`lib/url-fetch.test.ts`** — pure helpers (input validation, protocol check, LinkedIn early-out) tested directly. Network fetch NOT tested (out of scope).
- **`lib/search-settings.test.ts`** — `isSearchConfigured` for each engine/config combination.
- **`lib/prompts/gaps.test.ts`** — extend: `buildGapAnalysisPrompt` with `sources` contains the `<sources>` block and the inline marker instruction.
- **`lib/prompts/learningPath.test.ts`** — extend: `buildLearningPathPrompt` with `sources` contains the footnote block.
- **`lib/prompts/interview.test.ts`** — extend: with `sources` AND `role-specific` phase → block present; with sources AND other phases → NOT present.

### Manual QA checklist

- [ ] Fresh install: settings shows DuckDuckGo as default search engine
- [ ] Fresh install: no settings action needed to run grounded gap analysis
- [ ] Settings: switch to Brave, enter key, click Test search → success toast
- [ ] Settings: switch to Brave with no key → Test search fails gracefully
- [ ] Settings: switch to SearXNG with no URL → Test search fails gracefully
- [ ] Settings: switch to Disabled → save → grounded features run without search
- [ ] Run gap analysis with grounding → analysis has inline `[1]`, `[2]` markers → clicking scrolls to sources
- [ ] Copy as Markdown → exported markdown preserves `[1]` markers
- [ ] Run gap analysis twice for same target → cache hit (check terminal log)
- [ ] Run learning path with grounding → footnote list at bottom, no inline markers in body
- [ ] Learning path → Practice interview → gap analysis chain: sources accumulate independently per feature
- [ ] Gap analysis when search returns zero results → fallback notice appears, analysis still renders
- [ ] Interview role-specific phase: first turn triggers search, second turn hits cache
- [ ] Interview feedback panel: "Sources consulted during this interview" section shows at bottom
- [ ] Interview feedback: sources section absent when role-specific was never reached
- [ ] Chat: click "Look this up" → prompt appears → enter query → next message has source list underneath
- [ ] Chat: multiple look-ups → each assistant message shows its own sources
- [ ] Landing: paste a Seek job URL → fetched, populated into Job advert, status chip shows
- [ ] Landing: paste a LinkedIn profile URL → LinkedIn-blocked error toast, field keeps value
- [ ] Landing: paste a GitHub profile URL → fetched into About you
- [ ] Landing: paste a random article URL → fetched, classified unknown, routed to Job advert
- [ ] URL status chip clear button → removes chip, does NOT clear target field content
- [ ] Run grounded action with network disconnect → groundingFailed notice, analysis still works
- [ ] Run grounded action with `searchEngine: 'disabled'` → no notice, no sources, clean output
- [ ] Gap analysis with model that doesn't tag citations → fallback notice shows
- [ ] Small-model disclaimer appears only when sources exist AND engine not disabled
- [ ] Privacy note visible in settings search section
- [ ] About page updated bullet visible
- [ ] Electron dev build works end to end (`npm run electron:dev`)

### Not testing in Phase 3

- Actual search result quality (subjective; manual review)
- Site filter effectiveness (depends on each engine's interpretation)
- LinkedIn scraping success (explicitly not supported)
- Long-term resilience of DuckDuckGo HTML scraping (could break with markup change)
- Citation accuracy by the LLM (only manual review)

---

## Scope & non-goals

### In scope

- Port Study Buddy's 6-engine search dispatcher to `app/api/getSources/route.ts` with intent + cache layering
- `lib/search-service.ts`, `lib/search-cache.ts`, `lib/search-intent.ts`, `lib/search-prompt.ts`, `lib/search-settings.ts`
- `lib/citation-detect.ts`
- `lib/url-fetch.ts`, `lib/url-classify.ts`
- `app/api/fetchUrl/route.ts`, `app/api/chatSearch/route.ts`
- Modified API routes: `/api/gapAnalysis`, `/api/learningPath`, `/api/interview`, `/api/chat` all accept grounding inputs and return sources
- New components: `SourcesList` (shared compact + full), `InlineCitation`, `UrlInputField`, `LookUpButton`
- Session store additions: `urlInput`, `urlFetchedTitle`, `gapAnalysisSources`, `learningPathSources`, `interviewSources`, `chatSources`
- Settings store additions: `searchEngine` and `searchUrl` as SettingsConfig fields; search API keys stored via namespaced safeStorage (`search-brave`, `search-bing`, `search-serper`)
- Settings page: Research & Grounding section + Test search button
- About page: privacy bullet update
- Landing: URL field added above the existing grid
- Dependencies added: `@mozilla/readability`, `jsdom`
- Unit tests for all new pure helpers; extended tests for prompt builders that accept sources

### Explicitly out of scope (deferred)

| Deferred | Target |
|---|---|
| LinkedIn profile scraping via embedded browser | Never — ToS-hostile |
| Grounded "Find my careers" | Never — creative task, grounding constrains |
| LLM-native search (provider built-in tools) | Future — wait until Anthropic tool use stabilises |
| Academic paper search | Never — wrong domain |
| Persistent search cache across app launches | Never — violates principle |
| Server-side shared cache | Never — incompatible with local-first |
| Multi-query per feature | Out of scope — one targeted search each |
| Automatic query refinement on low results | Out of scope |
| Real-time source streaming | Out of scope |
| Tavily / Exa / Perplexity API integrations | Future if there's demand |
| LLM summarisation of fetched URL content | Out of scope — readability extract is sufficient |
| Multiple URL fetches at once | Out of scope |
| "Open all sources in browser" bulk action | Out of scope |

### Carry-forward notes

- LLM-native search will eventually replace the dispatcher — revisit when Anthropic's tool use stabilises.
- Phase 4 (workshop activities) doesn't need grounding — F11, F12, F10 are reflection tasks.
- Phase 5 (materials + export) might benefit from search for cover letter company research — Phase 5 decision.

---

## Open questions

None blocking. Resolved during brainstorming and captured above:

- Integration approach → port Study Buddy's dispatcher, add intent + cache layers
- Grounding coverage → (a) opt-in for chat, (b) always-on for gap analysis + learning path + interview role-specific
- Citation style → B for most features, C (inline markers) for gap analysis with fallback
- URL input model → A with smart routing (single field, classifier picks target)
- Caching → in-memory session cache with 50-entry LRU, no TTL
- Search engine default → DuckDuckGo (free, no setup, matches privacy-first ethos)
- LinkedIn profile handling → early-out with helpful error, no scraping attempts
