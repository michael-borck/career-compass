# Phase 3 — Search Grounding + URL Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 3 — web-search grounding for gap analysis, learning path, interview role-specific phase, and opt-in chat look-up, plus a URL input for pasting online content that routes to the right existing input field.

**Architecture:** Port Study Buddy's 6-engine search dispatcher (DuckDuckGo default, plus Brave / Bing / Serper / SearXNG / disabled), wrap it in an intent-aware query layer and an in-process LRU cache, and expose a shared `lib/search-service.search()` helper. Grounded API routes fetch sources before the LLM call, fold them into prompts via two citation styles (inline `[n]` for gap analysis, footnote for the rest), and return sources alongside the parsed output. URL input uses `@mozilla/readability` + `jsdom` for content extraction and a small pattern-list classifier to route fetched content into `jobAdvert` or `freeText` fields on the session store.

**Tech Stack:** Next.js 14 App Router · TypeScript · Zustand · Vitest · `@mozilla/readability` + `jsdom` (new). No new UI libraries.

**Spec reference:** `docs/superpowers/specs/2026-04-13-phase3-search-grounding-url-input-design.md`

---

## Notes for the implementer

- **Build on Phases 1 + 2 + F14.** Session store, prompt builders, API routes, settings store, Studio Calm tokens are all live. Read the Phase 2 spec and F14 spec first if you need orientation.
- **TDD discipline.** Every pure helper (search-intent, search-cache, search-prompt, citation-detect, url-classify, url-fetch pure bits) gets tests first. UI components get manual QA only.
- **One commit per task minimum.** Smaller is fine.
- **Frequent type-checks.** After every task run `npx tsc --noEmit`. Expected clean on all task boundaries.
- **All paths are absolute from the repo root** (`/Users/michael/Projects/career-compass/...`). Examples below omit the prefix.
- **Conventions:** Studio Calm Tailwind tokens, Lucide icons, `react-hot-toast`, `useRouter` from `next/navigation`, existing UI primitives in `components/ui/` (lowercase).
- **Don't reformat unrelated files.** Only touch what each task lists.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/search-intent.ts` | `applyIntent(query, intent)` — site filter appender |
| `lib/search-intent.test.ts` | Unit tests |
| `lib/search-cache.ts` | LRU in-process cache: `getCached`, `setCached`, `makeKey` |
| `lib/search-cache.test.ts` | Unit tests |
| `lib/search-prompt.ts` | `formatSourcesForFootnote`, `formatSourcesForInlineCite` |
| `lib/search-prompt.test.ts` | Unit tests |
| `lib/citation-detect.ts` | `segmentCitations`, `hasAnyCitations` |
| `lib/citation-detect.test.ts` | Unit tests |
| `lib/url-classify.ts` | `classifyUrl` — pattern-list hostname/path classifier |
| `lib/url-classify.test.ts` | Unit tests |
| `lib/search-settings.ts` | `loadSearchSettings`, `isSearchConfigured` — server-side |
| `lib/search-settings.test.ts` | Unit tests (for `isSearchConfigured`; loadSearchSettings is tested indirectly) |
| `lib/search-service.ts` | `search({query, intent?})` — shared server-side entry point |
| `lib/url-fetch.ts` | `fetchAndExtract(url)` + `UrlFetchError` |
| `app/api/getSources/route.ts` | 6-engine dispatcher ported from Study Buddy with intent + cache |
| `app/api/fetchUrl/route.ts` | POST wrapper around `fetchAndExtract` + `classifyUrl` |
| `app/api/chatSearch/route.ts` | Thin wrapper around `search()` for chat opt-in look-ups |
| `components/results/SourcesList.tsx` | Shared source list component (compact + full variants) |
| `components/results/InlineCitation.tsx` | `[n]` superscript link |
| `components/landing/UrlInputField.tsx` | Landing URL field with fetch-on-blur and status chip |
| `components/chat/LookUpButton.tsx` | Small "Look this up" button with inline prompt |

### Modified files

| Path | Change |
|---|---|
| `lib/session-store.ts` | Add Phase 3 types/fields/actions: `SourceRef`, `urlInput`, `urlFetchedTitle`, `gapAnalysisSources`, `learningPathSources`, `interviewSources`, `chatSources`, plus setters. `reset()` clears all via `initialState`. |
| `lib/session-store.test.ts` | Extend tests for new fields, setters, reset. |
| `lib/settings-store.ts` | Extend `SettingsConfig` with `searchEngine` and `searchUrl`. Refactor `secureStorage` into namespaced `getKey`/`setKey` API; preserve existing `getApiKey`/`setApiKey` as thin wrappers over the new helpers. Add `getSearchApiKey`/`setSearchApiKey` helpers. |
| `lib/prompts/gaps.ts` | `buildGapAnalysisPrompt` accepts optional `sources`. Appends inline-cite block + marker instruction when present. |
| `lib/prompts/gaps.test.ts` | Add tests for the sources path. |
| `lib/prompts/learningPath.ts` | `buildLearningPathPrompt` accepts optional `sources`. Appends footnote block when present. |
| `lib/prompts/learningPath.test.ts` | Add tests for the sources path. |
| `lib/prompts/interview.ts` | `buildInterviewSystemPrompt` accepts optional `sources`. Appends footnote block with "do not cite inline" when phase is `role-specific`. |
| `lib/prompts/interview.test.ts` | Add tests for phase gating. |
| `lib/markdown-export.ts` | `gapAnalysisToMarkdown`, `learningPathToMarkdown`, `interviewFeedbackToMarkdown` accept optional `sources` and append a Sources section. |
| `lib/markdown-export.test.ts` | Add tests for each exporter with sources. |
| `app/api/gapAnalysis/route.ts` | Accept `grounded: boolean`. Fire search with intent `salary`, thread `sources` to prompt, return `{analysis, trimmed, sources, groundingFailed}`. |
| `app/api/learningPath/route.ts` | Same pattern with intent `course` and optional `gapAnalysis` chain augmentation. |
| `app/api/interview/route.ts` | Phase-guarded grounding — fire search with intent `general` only when `phase === 'role-specific'`. Return sources in the response. |
| `app/api/chat/route.ts` | Accept optional `searchSources` in the request body. When present, append `formatSourcesForFootnote` as an extra system message for that turn only. |
| `components/landing/InputsZone.tsx` | Add `<UrlInputField />` as a full-width row above the existing 2×2 grid. |
| `components/landing/ActionsZone.tsx` | Pass `grounded: true` on gap analysis / learning path calls based on `isSearchConfigured` client-side check. |
| `components/results/GapAnalysisView.tsx` | Render `<SourcesList>` at the bottom; wrap `[n]` markers in `<InlineCitation>` via `segmentCitations`; fallback notice when sources exist but no markers; small-model disclaimer. |
| `components/results/LearningPathView.tsx` | Render `<SourcesList>` at the bottom. |
| `components/interview/InterviewFeedbackView.tsx` | Render `<SourcesList>` with "Sources consulted during this interview" heading when `interviewSources.length > 0`. |
| `components/interview/InterviewChat.tsx` | Collect `sources` from `/api/interview` response and call `store.addInterviewSources(sources)`. |
| `components/chat/ChatComposer.tsx` | Add optional `onLookUp` prop. When provided, render `<LookUpButton />` next to send. |
| `components/chat/ChatMessageList.tsx` | For each assistant message with an entry in `chatSources`, render `<SourcesList compact />` under the bubble. |
| `app/chat/page.tsx` | Wire up `onLookUp` and the look-up flow (`chatSearch` + `chat` with `searchSources`). |
| `app/settings/page.tsx` | Add "Research & Grounding" section with engine radio, conditional API key / URL fields, Test search button, privacy note. |
| `app/about/page.tsx` | Update one privacy bullet. |
| `package.json` | Add `@mozilla/readability` and `jsdom` dependencies. |

---

## Task 1: Session store extension

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Add `SourceRef` type and Phase 3 fields to `SessionState`**

Open `lib/session-store.ts`. Add near the other Phase 2 / F14 types:

```ts
export type SourceRef = {
  title: string;
  url: string;
  domain: string;
};
```

In `SessionState`, add to the `// Inputs` block, after `jobAdvert`:

```ts
  urlInput: string;
  urlFetchedTitle: string | null;
```

Add a new `// Grounding sources` block after the `// Interview` block:

```ts
  // Grounding sources
  gapAnalysisSources: SourceRef[] | null;
  learningPathSources: SourceRef[] | null;
  interviewSources: SourceRef[];
  chatSources: Record<string, SourceRef[]>;
```

In the actions block, after `setInterviewFeedback`, add:

```ts
  setUrlInput: (url: string) => void;
  setUrlFetchedTitle: (title: string | null) => void;
  setGapAnalysisSources: (s: SourceRef[] | null) => void;
  setLearningPathSources: (s: SourceRef[] | null) => void;
  addInterviewSources: (sources: SourceRef[]) => void;
  setChatSourcesForMessage: (messageId: string, sources: SourceRef[]) => void;
```

- [ ] **Step 2: Update `initialState` and actions**

In `initialState`, add after the existing Phase 2 / F14 defaults:

```ts
  urlInput: '',
  urlFetchedTitle: null,
  gapAnalysisSources: null,
  learningPathSources: null,
  interviewSources: [],
  chatSources: {},
```

In the `create<SessionState>(...)` body, after the F14 actions, add:

```ts
  setUrlInput: (url) => set({ urlInput: url }),
  setUrlFetchedTitle: (title) => set({ urlFetchedTitle: title }),
  setGapAnalysisSources: (s) => set({ gapAnalysisSources: s }),
  setLearningPathSources: (s) => set({ learningPathSources: s }),

  addInterviewSources: (sources) =>
    set((state) => {
      const existing = new Set(state.interviewSources.map((s) => s.url));
      const fresh = sources.filter((s) => !existing.has(s.url));
      return { interviewSources: [...state.interviewSources, ...fresh] };
    }),

  setChatSourcesForMessage: (messageId, sources) =>
    set((state) => ({
      chatSources: { ...state.chatSources, [messageId]: sources },
    })),
```

The existing `reset()` action uses `set({ ...initialState })` so it'll clear the new fields automatically — no change needed.

`resetInterview()` is defined from F14. Update it to also clear `interviewSources`:

Find `resetInterview` and change the set body to include `interviewSources: []`. It should look like:

```ts
  resetInterview: () =>
    set({
      interviewMessages: [],
      interviewTarget: null,
      interviewDifficulty: 'standard',
      interviewPhase: null,
      interviewTurnInPhase: 0,
      interviewFeedback: null,
      interviewSources: [],
    }),
```

Leave other resetInterview-adjacent code unchanged.

- [ ] **Step 3: Extend initial-state test**

Open `lib/session-store.test.ts`. Find the `it('has empty initial state', ...)` test and add assertions for the new fields:

```ts
    expect(s.urlInput).toBe('');
    expect(s.urlFetchedTitle).toBeNull();
    expect(s.gapAnalysisSources).toBeNull();
    expect(s.learningPathSources).toBeNull();
    expect(s.interviewSources).toEqual([]);
    expect(s.chatSources).toEqual({});
```

- [ ] **Step 4: Add tests for new setters**

Append to the `describe('session store actions', ...)` block:

```ts
  it('setUrlInput and setUrlFetchedTitle write fields', () => {
    const s = useSessionStore.getState();
    s.setUrlInput('https://example.com/job');
    s.setUrlFetchedTitle('Data Analyst — Example');
    const after = useSessionStore.getState();
    expect(after.urlInput).toBe('https://example.com/job');
    expect(after.urlFetchedTitle).toBe('Data Analyst — Example');
  });

  it('setGapAnalysisSources writes the field', () => {
    useSessionStore.getState().setGapAnalysisSources([
      { title: 'Glassdoor', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
    ]);
    expect(useSessionStore.getState().gapAnalysisSources).toHaveLength(1);
  });

  it('addInterviewSources dedupes by URL', () => {
    const s = useSessionStore.getState();
    s.addInterviewSources([
      { title: 'A', url: 'https://a.com', domain: 'a.com' },
      { title: 'B', url: 'https://b.com', domain: 'b.com' },
    ]);
    s.addInterviewSources([
      { title: 'A duplicate', url: 'https://a.com', domain: 'a.com' },
      { title: 'C', url: 'https://c.com', domain: 'c.com' },
    ]);
    const sources = useSessionStore.getState().interviewSources;
    expect(sources).toHaveLength(3);
    expect(sources.map((x) => x.url)).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
    ]);
  });

  it('setChatSourcesForMessage stores sources under the message id', () => {
    useSessionStore.getState().setChatSourcesForMessage('msg-1', [
      { title: 'A', url: 'https://a.com', domain: 'a.com' },
    ]);
    useSessionStore.getState().setChatSourcesForMessage('msg-2', [
      { title: 'B', url: 'https://b.com', domain: 'b.com' },
    ]);
    const cs = useSessionStore.getState().chatSources;
    expect(cs['msg-1']).toHaveLength(1);
    expect(cs['msg-2']).toHaveLength(1);
  });

  it('resetInterview clears interviewSources', () => {
    const s = useSessionStore.getState();
    s.addInterviewSources([{ title: 'A', url: 'https://a.com', domain: 'a.com' }]);
    s.resetInterview();
    expect(useSessionStore.getState().interviewSources).toEqual([]);
  });
```

Find the existing `it('reset clears everything', ...)` test. Extend the setup to populate the new fields, and the assertions to check they're cleared:

In the setup section, add before `s.reset()`:

```ts
    s.setUrlInput('http://x');
    s.setUrlFetchedTitle('T');
    s.setGapAnalysisSources([{ title: 'A', url: 'u', domain: 'd' }]);
    s.setLearningPathSources([{ title: 'A', url: 'u', domain: 'd' }]);
    s.addInterviewSources([{ title: 'A', url: 'u2', domain: 'd' }]);
    s.setChatSourcesForMessage('m', [{ title: 'A', url: 'u3', domain: 'd' }]);
```

In the assertions after reset, add:

```ts
    expect(after.urlInput).toBe('');
    expect(after.urlFetchedTitle).toBeNull();
    expect(after.gapAnalysisSources).toBeNull();
    expect(after.learningPathSources).toBeNull();
    expect(after.interviewSources).toEqual([]);
    expect(after.chatSources).toEqual({});
```

- [ ] **Step 5: Run tests and type-check**

Run: `npm run test -- lib/session-store.test.ts`
Expected: PASS including the 5 new tests.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "Add Phase 3 session store fields for sources and URL input"
```

---

## Task 2: Namespaced secureStorage refactor + SettingsConfig extension

**Files:**
- Modify: `lib/settings-store.ts`

- [ ] **Step 1: Read the current file**

Read `lib/settings-store.ts` to understand its current shape. It currently exports `settingsStore` (reads/writes `SettingsConfig`) and `secureStorage` with `getApiKey(provider)` / `setApiKey(provider, key)` methods keyed on LLM provider names.

- [ ] **Step 2: Extend `SettingsConfig`**

Add the new search fields to `SettingsConfig`. Include the type export:

```ts
export type SearchEngine =
  | 'disabled'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'serper'
  | 'searxng';

export interface SettingsConfig {
  // ... existing LLM fields unchanged
  provider: LLMProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  // New:
  searchEngine: SearchEngine;
  searchUrl: string;
}
```

Update any `DEFAULT_SETTINGS` constant or fallback in the file to include the new defaults:

```ts
  searchEngine: 'duckduckgo',
  searchUrl: '',
```

- [ ] **Step 3: Refactor `secureStorage` to namespaced API**

Find the current `secureStorage` export. It likely has `getApiKey(provider)` and `setApiKey(provider, key)` methods that build a key name like `career-compass-${provider}` and call into `window.electronAPI.secureStorage.getPassword` / `setPassword`.

Refactor to a `getKey(namespace, id)` / `setKey(namespace, id, value)` primitive, then keep the old LLM-specific methods as thin wrappers, and add new search-specific wrappers.

Replacement shape:

```ts
export const secureStorage = {
  async getKey(namespace: string, id: string): Promise<string | null> {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return null;
    }
    const keyName = `career-compass-${namespace}-${id}`;
    try {
      return await (window as any).electronAPI.secureStorage.getPassword(keyName);
    } catch {
      return null;
    }
  },

  async setKey(namespace: string, id: string, value: string): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return;
    const keyName = `career-compass-${namespace}-${id}`;
    await (window as any).electronAPI.secureStorage.setPassword(keyName, value);
  },

  async deleteKey(namespace: string, id: string): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).electronAPI) return;
    const keyName = `career-compass-${namespace}-${id}`;
    await (window as any).electronAPI.secureStorage.deletePassword(keyName);
  },

  // Back-compat wrappers for LLM provider keys — unchanged external API
  async getApiKey(provider: string): Promise<string | null> {
    return this.getKey('llm', provider);
  },

  async setApiKey(provider: string, key: string): Promise<void> {
    return this.setKey('llm', provider, key);
  },

  // New wrappers for search engine keys
  async getSearchApiKey(engine: SearchEngine): Promise<string | null> {
    return this.getKey('search', engine);
  },

  async setSearchApiKey(engine: SearchEngine, key: string): Promise<void> {
    return this.setKey('search', engine, key);
  },
};
```

**Important:** the generated keyName for LLM providers changes from `career-compass-${provider}` to `career-compass-llm-${provider}`. That's a breaking change for existing users. To avoid forcing a re-entry of API keys, add migration fallback inside `getKey`: if the namespaced lookup misses for the `llm` namespace, also try the legacy non-namespaced key name. The migration is write-through on next save.

Add this inside `getKey` after the primary lookup fails:

```ts
    // Migration fallback: older installs stored LLM keys without the namespace.
    if (namespace === 'llm') {
      const legacyKeyName = `career-compass-${id}`;
      try {
        const legacy = await (window as any).electronAPI.secureStorage.getPassword(legacyKeyName);
        if (legacy) return legacy;
      } catch {
        // ignore
      }
    }
    return null;
```

Place it after the first try/catch block, so the migration lookup runs only when the primary lookup returns null or errors.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Existing callers of `secureStorage.getApiKey` / `setApiKey` still work via the back-compat wrappers.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: all existing tests still pass. No new tests in this task.

- [ ] **Step 6: Commit**

```bash
git add lib/settings-store.ts
git commit -m "Refactor secureStorage to namespaced API; add search settings

Adds searchEngine and searchUrl fields to SettingsConfig.
Refactors secureStorage to a generic getKey/setKey pair,
preserves getApiKey/setApiKey as thin back-compat wrappers for
LLM provider keys, and adds getSearchApiKey/setSearchApiKey for
search engine keys. Includes a migration fallback so existing
LLM keys stored without the namespace still load."
```

---

## Task 3: lib/search-intent.ts (TDD)

**Files:**
- Create: `lib/search-intent.ts`
- Create: `lib/search-intent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/search-intent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyIntent } from './search-intent';

describe('applyIntent', () => {
  it('returns the query unchanged for general intent', () => {
    expect(applyIntent('data analyst salary', 'general')).toBe('data analyst salary');
  });

  it('appends salary site filters for salary intent', () => {
    const out = applyIntent('data analyst Perth', 'salary');
    expect(out).toContain('data analyst Perth');
    expect(out).toContain('site:glassdoor.com');
    expect(out).toContain('site:levels.fyi');
    expect(out).toContain('site:seek.com.au');
    expect(out).toContain('OR');
  });

  it('appends course site filters for course intent', () => {
    const out = applyIntent('intermediate SQL', 'course');
    expect(out).toContain('intermediate SQL');
    expect(out).toContain('site:coursera.org');
    expect(out).toContain('site:edx.org');
    expect(out).toContain('site:udemy.com');
  });

  it('appends company site filters for company intent', () => {
    const out = applyIntent('Acme Corp', 'company');
    expect(out).toContain('Acme Corp');
    expect(out).toContain('site:linkedin.com/company');
    expect(out).toContain('site:crunchbase.com');
  });

  it('handles empty query without crashing', () => {
    const out = applyIntent('', 'salary');
    expect(out).toContain('site:glassdoor.com');
  });

  it('wraps filters in parentheses', () => {
    const out = applyIntent('test', 'salary');
    expect(out).toContain('(site:');
    expect(out).toContain(')');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/search-intent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/search-intent.ts`:

```ts
export type SearchIntent = 'salary' | 'course' | 'company' | 'general';

const INTENT_FILTERS: Record<Exclude<SearchIntent, 'general'>, string[]> = {
  salary: [
    'glassdoor.com',
    'levels.fyi',
    'seek.com.au',
    'indeed.com',
    'payscale.com',
    'linkedin.com/jobs',
  ],
  course: [
    'coursera.org',
    'edx.org',
    'udemy.com',
    'linkedin.com/learning',
    'pluralsight.com',
    'freecodecamp.org',
    'youtube.com',
  ],
  company: [
    'linkedin.com/company',
    'glassdoor.com',
    'crunchbase.com',
    'wikipedia.org',
  ],
};

export function applyIntent(query: string, intent: SearchIntent): string {
  if (intent === 'general') return query;
  const sites = INTENT_FILTERS[intent];
  const siteFilter = sites.map((s) => `site:${s}`).join(' OR ');
  return `${query} (${siteFilter})`;
}
```

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/search-intent.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/search-intent.ts lib/search-intent.test.ts
git commit -m "Add search intent query modifier with site filters"
```

---

## Task 4: lib/search-cache.ts (TDD)

**Files:**
- Create: `lib/search-cache.ts`
- Create: `lib/search-cache.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/search-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getCached, setCached, makeKey, __resetCacheForTests } from './search-cache';
import type { SourceRef } from './session-store';

const sampleResults: SourceRef[] = [
  { title: 'Example', url: 'https://example.com', domain: 'example.com' },
];

describe('makeKey', () => {
  it('produces the same key for differently-cased queries', () => {
    expect(makeKey('duckduckgo', 'Data Analyst')).toBe(
      makeKey('duckduckgo', 'data analyst')
    );
  });

  it('produces the same key for differently-whitespaced queries', () => {
    expect(makeKey('duckduckgo', '  data   analyst  ')).toBe(
      makeKey('duckduckgo', 'data analyst')
    );
  });

  it('produces different keys per engine', () => {
    expect(makeKey('duckduckgo', 'q')).not.toBe(makeKey('brave', 'q'));
  });
});

describe('getCached / setCached', () => {
  beforeEach(() => {
    __resetCacheForTests();
  });

  it('returns null for a cache miss', () => {
    expect(getCached('missing')).toBeNull();
  });

  it('returns stored results for a cache hit', () => {
    setCached('hit', sampleResults);
    expect(getCached('hit')).toEqual(sampleResults);
  });

  it('evicts the oldest entry when over the 50-entry limit', () => {
    for (let i = 0; i < 50; i++) {
      setCached(`key-${i}`, sampleResults);
    }
    setCached('key-new', sampleResults);
    expect(getCached('key-0')).toBeNull();
    expect(getCached('key-new')).toEqual(sampleResults);
  });

  it('refreshes LRU position on cache hit', () => {
    for (let i = 0; i < 50; i++) {
      setCached(`key-${i}`, sampleResults);
    }
    // Touch key-0 so it becomes most recent
    getCached('key-0');
    // Insert a new one; key-1 should now be the oldest and evicted
    setCached('key-new', sampleResults);
    expect(getCached('key-0')).toEqual(sampleResults);
    expect(getCached('key-1')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/search-cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/search-cache.ts`:

```ts
import type { SourceRef } from './session-store';

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
  // Refresh LRU position by re-inserting
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

// Test-only helper. Not exported from the module's public API.
export function __resetCacheForTests(): void {
  cache.clear();
}
```

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/search-cache.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/search-cache.ts lib/search-cache.test.ts
git commit -m "Add in-process LRU search cache"
```

---

## Task 5: lib/search-prompt.ts (TDD)

**Files:**
- Create: `lib/search-prompt.ts`
- Create: `lib/search-prompt.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/search-prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatSourcesForFootnote, formatSourcesForInlineCite } from './search-prompt';
import type { SourceRef } from './session-store';

const sources: SourceRef[] = [
  { title: 'Glassdoor — Data Analyst', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
  { title: 'Levels.fyi Data Analyst', url: 'https://levels.fyi/x', domain: 'levels.fyi' },
];

describe('formatSourcesForFootnote', () => {
  it('returns empty string for empty sources', () => {
    expect(formatSourcesForFootnote([])).toBe('');
  });

  it('includes all sources numbered', () => {
    const out = formatSourcesForFootnote(sources);
    expect(out).toContain('[1] Glassdoor — Data Analyst (glassdoor.com)');
    expect(out).toContain('[2] Levels.fyi Data Analyst (levels.fyi)');
    expect(out).toContain('https://glassdoor.com/x');
  });

  it('wraps in a <sources> block', () => {
    const out = formatSourcesForFootnote(sources);
    expect(out).toContain('<sources>');
    expect(out).toContain('</sources>');
  });

  it('does NOT include inline marker instruction', () => {
    const out = formatSourcesForFootnote(sources);
    expect(out).not.toMatch(/add the source number as an inline marker/i);
  });
});

describe('formatSourcesForInlineCite', () => {
  it('returns empty string for empty sources', () => {
    expect(formatSourcesForInlineCite([])).toBe('');
  });

  it('includes all sources numbered', () => {
    const out = formatSourcesForInlineCite(sources);
    expect(out).toContain('[1] Glassdoor — Data Analyst');
    expect(out).toContain('[2] Levels.fyi Data Analyst');
  });

  it('includes the inline marker instruction', () => {
    const out = formatSourcesForInlineCite(sources);
    expect(out).toMatch(/inline marker/i);
    expect(out).toMatch(/\[1\] or \[2\]/);
  });

  it('wraps in a <sources> block', () => {
    const out = formatSourcesForInlineCite(sources);
    expect(out).toContain('<sources>');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/search-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/search-prompt.ts`:

```ts
import type { SourceRef } from './session-store';

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

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/search-prompt.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/search-prompt.ts lib/search-prompt.test.ts
git commit -m "Add search prompt formatters (footnote + inline cite)"
```

---

## Task 6: lib/citation-detect.ts (TDD)

**Files:**
- Create: `lib/citation-detect.ts`
- Create: `lib/citation-detect.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/citation-detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { segmentCitations, hasAnyCitations } from './citation-detect';

describe('hasAnyCitations', () => {
  it('returns false for plain text', () => {
    expect(hasAnyCitations('no markers here')).toBe(false);
  });

  it('returns true for a single marker', () => {
    expect(hasAnyCitations('salary is $85k [1]')).toBe(true);
  });

  it('returns true for multiple markers', () => {
    expect(hasAnyCitations('[1] and [2] and [3]')).toBe(true);
  });

  it('does NOT match malformed brackets', () => {
    expect(hasAnyCitations('[abc]')).toBe(false);
    expect(hasAnyCitations('[1abc]')).toBe(false);
  });
});

describe('segmentCitations', () => {
  it('returns a single text segment for plain text', () => {
    expect(segmentCitations('hello world')).toEqual([
      { kind: 'text', value: 'hello world' },
    ]);
  });

  it('splits text with one marker', () => {
    expect(segmentCitations('salary is $85k [1] for Perth')).toEqual([
      { kind: 'text', value: 'salary is $85k ' },
      { kind: 'cite', index: 1 },
      { kind: 'text', value: ' for Perth' },
    ]);
  });

  it('splits text with multiple markers', () => {
    expect(segmentCitations('a [1] b [2] c')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'cite', index: 1 },
      { kind: 'text', value: ' b ' },
      { kind: 'cite', index: 2 },
      { kind: 'text', value: ' c' },
    ]);
  });

  it('handles text ending with a marker', () => {
    expect(segmentCitations('salary [1]')).toEqual([
      { kind: 'text', value: 'salary ' },
      { kind: 'cite', index: 1 },
    ]);
  });

  it('handles text starting with a marker', () => {
    expect(segmentCitations('[1] is the source')).toEqual([
      { kind: 'cite', index: 1 },
      { kind: 'text', value: ' is the source' },
    ]);
  });

  it('treats malformed brackets as plain text', () => {
    expect(segmentCitations('hello [abc] world')).toEqual([
      { kind: 'text', value: 'hello [abc] world' },
    ]);
  });

  it('handles empty string', () => {
    expect(segmentCitations('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/citation-detect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/citation-detect.ts`:

```ts
export type CitationSegment =
  | { kind: 'text'; value: string }
  | { kind: 'cite'; index: number };

/**
 * Splits a string into text and citation segments. A citation is any
 * [<positive integer>] occurrence.
 */
export function segmentCitations(text: string): CitationSegment[] {
  if (text.length === 0) return [];
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

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/citation-detect.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/citation-detect.ts lib/citation-detect.test.ts
git commit -m "Add citation segmentation helper for inline [n] markers"
```

---

## Task 7: lib/url-classify.ts (TDD)

**Files:**
- Create: `lib/url-classify.ts`
- Create: `lib/url-classify.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/url-classify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyUrl } from './url-classify';

describe('classifyUrl — job adverts', () => {
  it('classifies Seek job URL', () => {
    expect(classifyUrl('https://www.seek.com.au/job/12345')).toBe('jobAdvert');
  });

  it('classifies Indeed job URL', () => {
    expect(classifyUrl('https://au.indeed.com/viewjob?jk=abc')).toBe('jobAdvert');
  });

  it('classifies LinkedIn job URL', () => {
    expect(classifyUrl('https://www.linkedin.com/jobs/view/123')).toBe('jobAdvert');
  });

  it('classifies Glassdoor job URL', () => {
    expect(classifyUrl('https://www.glassdoor.com/job-listing/Job-x')).toBe('jobAdvert');
  });

  it('classifies Workable URL', () => {
    expect(classifyUrl('https://acme.workable.com/j/ABC123')).toBe('jobAdvert');
  });

  it('classifies Greenhouse URL', () => {
    expect(classifyUrl('https://boards.greenhouse.io/acme/jobs/123')).toBe('jobAdvert');
  });

  it('classifies Lever URL', () => {
    expect(classifyUrl('https://jobs.lever.co/acme/abc')).toBe('jobAdvert');
  });
});

describe('classifyUrl — profile/portfolio', () => {
  it('classifies LinkedIn profile URL', () => {
    expect(classifyUrl('https://www.linkedin.com/in/michael-borck/')).toBe('freeText');
  });

  it('classifies GitHub profile URL', () => {
    expect(classifyUrl('https://github.com/michael-borck')).toBe('freeText');
  });

  it('classifies about.me URL', () => {
    expect(classifyUrl('https://about.me/someone')).toBe('freeText');
  });

  it('classifies notion.site URL', () => {
    expect(classifyUrl('https://user.notion.site/page')).toBe('freeText');
  });
});

describe('classifyUrl — unknown and malformed', () => {
  it('returns unknown for a random blog', () => {
    expect(classifyUrl('https://example.com/blog/post')).toBe('unknown');
  });

  it('returns unknown for malformed URL', () => {
    expect(classifyUrl('not a url at all')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(classifyUrl('')).toBe('unknown');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/url-classify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/url-classify.ts`:

```ts
export type UrlClassification = 'jobAdvert' | 'freeText' | 'unknown';

type Pattern = {
  classify: UrlClassification;
  match: (hostname: string, path: string) => boolean;
};

const PATTERNS: Pattern[] = [
  // Job postings
  { classify: 'jobAdvert', match: (h) => h.includes('seek.com') },
  { classify: 'jobAdvert', match: (h) => h.includes('indeed.com') },
  {
    classify: 'jobAdvert',
    match: (h, p) => h.includes('linkedin.com') && p.includes('/jobs/'),
  },
  {
    classify: 'jobAdvert',
    match: (h, p) => h.includes('glassdoor.com') && (p.includes('/job') || p.includes('/Job')),
  },
  { classify: 'jobAdvert', match: (h) => h.includes('workable.com') },
  { classify: 'jobAdvert', match: (h) => h.includes('greenhouse.io') },
  { classify: 'jobAdvert', match: (h) => h.includes('lever.co') },
  // Profile / portfolio
  {
    classify: 'freeText',
    match: (h, p) => h.includes('linkedin.com') && p.includes('/in/'),
  },
  { classify: 'freeText', match: (h) => h.includes('github.com') },
  { classify: 'freeText', match: (h) => h.includes('about.me') },
  { classify: 'freeText', match: (h) => h.includes('notion.site') },
  { classify: 'freeText', match: (h) => h.endsWith('.carrd.co') },
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

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/url-classify.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/url-classify.ts lib/url-classify.test.ts
git commit -m "Add URL classifier for smart routing into input fields"
```

---

## Task 8: lib/search-settings.ts (with tests for isSearchConfigured)

**Files:**
- Create: `lib/search-settings.ts`
- Create: `lib/search-settings.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/search-settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isSearchConfigured, type SearchSettings } from './search-settings';

function makeSettings(partial: Partial<SearchSettings>): SearchSettings {
  return { engine: 'duckduckgo', apiKey: '', url: '', ...partial };
}

describe('isSearchConfigured', () => {
  it('returns false when engine is disabled', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'disabled' }))).toBe(false);
  });

  it('returns true for duckduckgo regardless of keys', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'duckduckgo' }))).toBe(true);
  });

  it('returns false for brave without an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'brave', apiKey: '' }))).toBe(false);
  });

  it('returns true for brave with an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'brave', apiKey: 'k' }))).toBe(true);
  });

  it('returns false for bing without an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'bing' }))).toBe(false);
  });

  it('returns true for bing with an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'bing', apiKey: 'k' }))).toBe(true);
  });

  it('returns false for serper without an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'serper' }))).toBe(false);
  });

  it('returns true for serper with an API key', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'serper', apiKey: 'k' }))).toBe(true);
  });

  it('returns false for searxng without a URL', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'searxng' }))).toBe(false);
  });

  it('returns true for searxng with a URL', () => {
    expect(isSearchConfigured(makeSettings({ engine: 'searxng', url: 'http://x' }))).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/search-settings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/search-settings.ts`:

```ts
import { settingsStore, secureStorage, type SearchEngine } from './settings-store';

export type SearchSettings = {
  engine: SearchEngine;
  apiKey: string;
  url: string;
};

/**
 * Loads search settings from the settings store and (when applicable) the
 * secure API key storage. Returns a plain object suitable for routing
 * decisions in the search service layer.
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
```

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/search-settings.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/search-settings.ts lib/search-settings.test.ts
git commit -m "Add search settings loader and isSearchConfigured check"
```

---

## Task 9: lib/url-fetch.ts + npm deps

**Files:**
- Modify: `package.json`
- Create: `lib/url-fetch.ts`

`url-fetch` is tested only for pure bits (invalid URLs, LinkedIn early-out). Real network fetches are manual-QA only.

- [ ] **Step 1: Install dependencies**

Run from the repo root:

```bash
npm install @mozilla/readability jsdom
npm install --save-dev @types/jsdom
```

Expected: three new entries in `package.json` dependencies. Don't commit the `node_modules/` folder.

- [ ] **Step 2: Create `lib/url-fetch.ts`**

```ts
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export type FetchResult = {
  text: string;
  title: string;
  domain: string;
};

export type UrlFetchErrorCode =
  | 'invalid'
  | 'timeout'
  | 'linkedin-blocked'
  | 'network'
  | 'no-content';

export class UrlFetchError extends Error {
  constructor(message: string, public code: UrlFetchErrorCode) {
    super(message);
    this.name = 'UrlFetchError';
  }
}

const TIMEOUT_MS = 10000;
const MAX_BYTES = 2_000_000;

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
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new UrlFetchError('The page took too long to respond.', 'timeout');
    }
    throw new UrlFetchError(
      `Could not fetch the URL: ${err?.message ?? 'unknown error'}`,
      'network'
    );
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

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run full test suite**

Run: `npm run test`
Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/url-fetch.ts
git commit -m "Add URL fetch and extract helper (@mozilla/readability + jsdom)"
```

---

## Task 10: Port /api/getSources route + lib/search-service.ts

**Files:**
- Create: `app/api/getSources/route.ts`
- Create: `lib/search-service.ts`

The port is from `/Users/michael/Projects/study-buddy/app/api/getSources/route.ts`. Study Buddy's route has 6 engine branches; we refactor the per-engine logic into a helper that `search-service.ts` can also call, then the route becomes a thin wrapper.

- [ ] **Step 1: Create `lib/search-service.ts`**

```ts
import type { SourceRef } from './session-store';
import { getCached, setCached, makeKey } from './search-cache';
import { applyIntent, type SearchIntent } from './search-intent';
import { loadSearchSettings, type SearchSettings } from './search-settings';
import { z } from 'zod';

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

// ---------- DuckDuckGo (HTML scraping of lite.duckduckgo.com) ----------

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

// ---------- Brave Search API ----------

const BraveSchema = z.object({
  web: z.object({
    results: z.array(z.object({ title: z.string(), url: z.string() })),
  }),
});

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
  const raw = await response.json();
  const data = BraveSchema.parse(raw);
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

const BingSchema = z.object({
  webPages: z.object({
    value: z.array(z.object({ name: z.string(), url: z.string() })),
  }),
});

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
  const raw = await response.json();
  const data = BingSchema.parse(raw);
  return data.webPages.value.map((r) => ({
    title: r.name,
    url: r.url,
    domain: extractDomain(r.url),
  }));
}

// ---------- Serper ----------

const SerperSchema = z.object({
  organic: z.array(z.object({ title: z.string(), link: z.string() })),
});

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
  const raw = await response.json();
  const data = SerperSchema.parse(raw);
  return data.organic
    .filter((r) => !isExcluded(r.link, EXCLUDED_SITES))
    .map((r) => ({
      title: r.title,
      url: r.link,
      domain: extractDomain(r.link),
    }));
}

// ---------- SearXNG ----------

const SearxngSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string().optional(),
    })
  ),
});

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

  const raw = await response.json();
  const data = SearxngSchema.parse(raw);
  return data.results
    .filter((r) => !isExcluded(r.url, EXCLUDED_SITES))
    .slice(0, 9)
    .map((r) => ({
      title: r.title,
      url: r.url,
      domain: extractDomain(r.url),
    }));
}
```

Note: we simplify Study Buddy's SearXNG retry logic to a single attempt. If SearXNG is flaky, the caller's graceful-fallback path handles it. Keeping the logic simple is worth the occasional extra retry cost.

- [ ] **Step 2: Create `app/api/getSources/route.ts`**

Thin wrapper around `search()`:

```ts
import { NextRequest } from 'next/server';
import { search } from '@/lib/search-service';
import type { SearchIntent } from '@/lib/search-intent';

interface GetSourcesRequest {
  query: string;
  intent?: SearchIntent;
}

export async function POST(request: NextRequest) {
  try {
    const { query, intent } = (await request.json()) as GetSourcesRequest;
    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400 }
      );
    }
    const results = await search({ query: query.trim(), intent });
    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (error) {
    console.error('[getSources] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check + tests**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/getSources/route.ts lib/search-service.ts
git commit -m "Port Study Buddy's search dispatcher with intent + cache

Six engines: DuckDuckGo (default), Brave, Bing, Serper, SearXNG,
disabled. Results normalized to SourceRef. Cached by engine+query.
Excluded sites: youtube, pinterest, reddit/r/."
```

---

## Task 11: /api/fetchUrl route

**Files:**
- Create: `app/api/fetchUrl/route.ts`

- [ ] **Step 1: Create the route**

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

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add app/api/fetchUrl/route.ts
git commit -m "Add /api/fetchUrl route"
```

---

## Task 12: /api/chatSearch route

**Files:**
- Create: `app/api/chatSearch/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { search } from '@/lib/search-service';

interface ChatSearchRequest {
  query: string;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = (await request.json()) as ChatSearchRequest;
    if (!query || !query.trim()) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
      });
    }
    const results = await search({ query: query.trim(), intent: 'general' });
    return new Response(JSON.stringify({ results }), { status: 200 });
  } catch (error) {
    console.error('[chatSearch] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add app/api/chatSearch/route.ts
git commit -m "Add /api/chatSearch route for opt-in look-ups"
```

---

## Task 13: Extend gap analysis prompt builder (TDD)

**Files:**
- Modify: `lib/prompts/gaps.ts`
- Modify: `lib/prompts/gaps.test.ts`

- [ ] **Step 1: Add failing tests**

Open `lib/prompts/gaps.test.ts`. Import the new helper at the top:

```ts
import type { SourceRef } from '@/lib/session-store';
```

Append to the `describe('buildGapAnalysisPrompt', ...)` block:

```ts
  it('includes sources block when sources are provided', () => {
    const sources: SourceRef[] = [
      { title: 'Glassdoor', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
    ];
    const out = buildGapAnalysisPrompt({
      jobTitle: 'Data Analyst',
      resume: 'r',
      sources,
    });
    expect(out).toContain('<sources>');
    expect(out).toContain('Glassdoor');
    expect(out).toContain('[1]');
    expect(out).toMatch(/inline marker/i);
  });

  it('does not include sources block when sources are absent', () => {
    const out = buildGapAnalysisPrompt({
      jobTitle: 'Data Analyst',
      resume: 'r',
    });
    expect(out).not.toContain('<sources>');
  });

  it('does not include sources block when sources are empty', () => {
    const out = buildGapAnalysisPrompt({
      jobTitle: 'Data Analyst',
      resume: 'r',
      sources: [],
    });
    expect(out).not.toContain('<sources>');
  });
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/prompts/gaps.test.ts`
Expected: FAIL — `sources` is not on the input type.

- [ ] **Step 3: Update `lib/prompts/gaps.ts`**

Add the import at the top:

```ts
import { formatSourcesForInlineCite } from '@/lib/search-prompt';
import type { SourceRef } from '@/lib/session-store';
```

Add `sources?: SourceRef[]` to `GapAnalysisInput`:

```ts
export type GapAnalysisInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  sources?: SourceRef[];
};
```

Inside `buildGapAnalysisPrompt`, after the profile section is pushed and before the final "ONLY respond with JSON" line, add:

```ts
  if (input.sources && input.sources.length > 0) {
    sections.push(formatSourcesForInlineCite(input.sources));
  }
```

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/prompts/gaps.test.ts`
Expected: PASS — existing tests plus the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/gaps.ts lib/prompts/gaps.test.ts
git commit -m "Accept sources in gap analysis prompt builder (inline cite)"
```

---

## Task 14: Extend learning path prompt builder (TDD)

**Files:**
- Modify: `lib/prompts/learningPath.ts`
- Modify: `lib/prompts/learningPath.test.ts`

- [ ] **Step 1: Add failing tests**

Open `lib/prompts/learningPath.test.ts`. Import at the top:

```ts
import type { SourceRef } from '@/lib/session-store';
```

Append to the `describe('buildLearningPathPrompt', ...)` block:

```ts
  it('includes sources block when sources are provided', () => {
    const sources: SourceRef[] = [
      { title: 'Coursera', url: 'https://coursera.org/x', domain: 'coursera.org' },
    ];
    const out = buildLearningPathPrompt({ jobTitle: 'Data Analyst', sources });
    expect(out).toContain('<sources>');
    expect(out).toContain('Coursera');
    expect(out).not.toMatch(/inline marker/i);
  });

  it('does not include sources block when sources are absent', () => {
    const out = buildLearningPathPrompt({ jobTitle: 'Data Analyst' });
    expect(out).not.toContain('<sources>');
  });
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/prompts/learningPath.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `lib/prompts/learningPath.ts`**

Add imports:

```ts
import { formatSourcesForFootnote } from '@/lib/search-prompt';
import type { SourceRef } from '@/lib/session-store';
```

Add `sources?: SourceRef[]` to `LearningPathInput`:

```ts
export type LearningPathInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  gapAnalysis?: GapAnalysis;
  sources?: SourceRef[];
};
```

Inside `buildLearningPathPrompt`, after the gap analysis section (or after the profile section if gapAnalysis is absent) and before the final "ONLY respond with JSON", add:

```ts
  if (input.sources && input.sources.length > 0) {
    sections.push(formatSourcesForFootnote(input.sources));
  }
```

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/prompts/learningPath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/learningPath.ts lib/prompts/learningPath.test.ts
git commit -m "Accept sources in learning path prompt builder (footnote)"
```

---

## Task 15: Extend interview prompt builder (TDD)

**Files:**
- Modify: `lib/prompts/interview.ts`
- Modify: `lib/prompts/interview.test.ts`

- [ ] **Step 1: Add failing tests**

Open `lib/prompts/interview.test.ts`. Import:

```ts
import type { SourceRef } from '@/lib/session-store';
```

Append to the `describe('buildInterviewSystemPrompt', ...)` block:

```ts
  it('includes sources block when sources are provided in role-specific phase', () => {
    const sources: SourceRef[] = [
      { title: 'Example', url: 'https://example.com', domain: 'example.com' },
    ];
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'role-specific',
      turnInPhase: 0,
      sources,
    });
    expect(out).toContain('<sources>');
    expect(out).toContain('Example');
  });

  it('does NOT include sources block in warm-up phase even with sources provided', () => {
    const sources: SourceRef[] = [
      { title: 'Example', url: 'https://example.com', domain: 'example.com' },
    ];
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'warm-up',
      turnInPhase: 0,
      sources,
    });
    expect(out).not.toContain('<sources>');
  });

  it('does NOT include sources block when sources are empty', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'role-specific',
      turnInPhase: 0,
      sources: [],
    });
    expect(out).not.toContain('<sources>');
  });
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/prompts/interview.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `lib/prompts/interview.ts`**

Add imports:

```ts
import { formatSourcesForFootnote } from '@/lib/search-prompt';
import type { SourceRef } from '@/lib/session-store';
```

Add `sources?: SourceRef[]` to `InterviewPromptInput`:

```ts
export type InterviewPromptInput = {
  target: string;
  difficulty: InterviewDifficulty;
  phase: InterviewPhase;
  turnInPhase: number;
  sources?: SourceRef[];
};
```

Inside `buildInterviewSystemPrompt`, after the existing prompt body is constructed (after the `GLOBAL RULES` section ends), add:

```ts
  const { sources } = input;
  if (
    sources &&
    sources.length > 0 &&
    phase === 'role-specific'
  ) {
    return `${baseSystemPrompt}

${formatSourcesForFootnote(sources)}

Use the sources above to understand what the role actually requires today. Do NOT mention the sources or cite them in your questions — just let them inform what you ask.`;
  }

  return baseSystemPrompt;
```

You'll need to refactor the existing `buildInterviewSystemPrompt` body to compute `baseSystemPrompt` as a local variable first instead of returning the template literal directly. The structure becomes:

```ts
export function buildInterviewSystemPrompt(input: InterviewPromptInput): string {
  const { target, difficulty, phase, turnInPhase, sources } = input;
  const config = PHASE_CONFIG[phase];

  const baseSystemPrompt = `You are conducting a practice job interview for the role of ${target}. The student is using this to prepare for real interviews.

DIFFICULTY: ${difficulty}
${DIFFICULTY_TONE[difficulty]}

CURRENT PHASE: ${config.description}
PHASE GUIDANCE: ${config.guidance}
Turn ${turnInPhase + 1} of ${config.turnsPerPhase}

GLOBAL RULES:
- Ask exactly ONE question per message. Wait for the student's answer before continuing.
- Do not give feedback during the interview. Stay in character as an interviewer.
- Use the student's resume / background / job advert (provided as context) to ask informed questions. Reference specific things from their background by name.
- Do not break character. Do not say "as an AI" or "in this practice session." You are an interviewer.
- Keep messages short — 2-4 sentences max. Real interviewers don't monologue.
- If the student goes off-topic, politely steer back to the interview.

The full system prompt is followed by additional context the student has shared (resume, background notes, job of interest). Use that context to make your questions feel grounded and personal.`;

  if (sources && sources.length > 0 && phase === 'role-specific') {
    return `${baseSystemPrompt}

${formatSourcesForFootnote(sources)}

Use the sources above to understand what the role actually requires today. Do NOT mention the sources or cite them in your questions — just let them inform what you ask.`;
  }

  return baseSystemPrompt;
}
```

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/prompts/interview.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/interview.ts lib/prompts/interview.test.ts
git commit -m "Accept sources in interview prompt builder (role-specific only)"
```

---

## Task 16: Extend markdown-export with sources (TDD)

**Files:**
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

- [ ] **Step 1: Add failing tests**

Open `lib/markdown-export.test.ts`. Add at the top alongside existing type imports:

```ts
import type { SourceRef } from './session-store';
```

Append to the file:

```ts
const sources: SourceRef[] = [
  { title: 'Glassdoor — Data Analyst', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
  { title: 'Seek — Data Analyst Perth', url: 'https://seek.com.au/y', domain: 'seek.com.au' },
];

describe('source rendering in markdown', () => {
  it('gap analysis markdown includes sources section when provided', () => {
    const md = gapAnalysisToMarkdown(gap, sources);
    expect(md).toContain('## Sources');
    expect(md).toContain('1. [Glassdoor — Data Analyst](https://glassdoor.com/x)');
    expect(md).toContain('2. [Seek — Data Analyst Perth](https://seek.com.au/y)');
  });

  it('gap analysis markdown omits sources section when no sources', () => {
    const md = gapAnalysisToMarkdown(gap);
    expect(md).not.toContain('## Sources');
  });

  it('learning path markdown includes sources section when provided', () => {
    const md = learningPathToMarkdown(path, sources);
    expect(md).toContain('## Sources');
  });

  it('interview feedback markdown includes sources section when provided', () => {
    const md = interviewFeedbackToMarkdown(feedback, sources);
    expect(md).toContain('## Sources consulted');
  });
});
```

(You may need to rename an existing `const gap` / `const path` / `const feedback` to avoid clashes with existing tests. If the existing test fixtures are scoped inside other describes, hoist them above this new describe block or inline new fixtures — whichever is cleaner.)

- [ ] **Step 2: Verify failure**

Run: `npm run test -- lib/markdown-export.test.ts`
Expected: FAIL — markdown exporters don't accept sources yet.

- [ ] **Step 3: Update `lib/markdown-export.ts`**

Add the `SourceRef` import:

```ts
import type { GapAnalysis, InterviewFeedback, InterviewPhase, LearningPath, SourceRef } from './session-store';
```

Update each of the three exporters to accept an optional `sources` parameter and render a Sources section if non-empty.

`gapAnalysisToMarkdown`:

```ts
export function gapAnalysisToMarkdown(
  g: GapAnalysis,
  sources?: SourceRef[]
): string {
  const lines: string[] = [];
  // ... existing body unchanged ...

  // Append sources at the very end, before the AI-generated footer
  if (sources && sources.length > 0) {
    lines.push('');
    lines.push('## Sources');
    sources.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url}) — ${s.domain}`);
    });
  }

  // The existing "AI-generated..." footer stays last
  // (reorder the existing push of the footer to come after the sources)
  return lines.join('\n');
}
```

Same pattern for `learningPathToMarkdown` and `interviewFeedbackToMarkdown`. For interview feedback, the heading is `## Sources consulted` (plural, matches the feedback panel heading).

Make sure the AI-generated footer line remains the very last line in all three exporters.

- [ ] **Step 4: Verify pass**

Run: `npm run test -- lib/markdown-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "Accept sources in markdown exporters"
```

---

## Task 17: Update /api/gapAnalysis + /api/learningPath for grounding

**Files:**
- Modify: `app/api/gapAnalysis/route.ts`
- Modify: `app/api/learningPath/route.ts`

- [ ] **Step 1: Update gap analysis route**

Read `app/api/gapAnalysis/route.ts` first. Add imports:

```ts
import { search } from '@/lib/search-service';
import { loadSearchSettings, isSearchConfigured } from '@/lib/search-settings';
```

Add `grounded: boolean` to the `GapAnalysisRequest` interface.

Inside the POST handler, after validating target/profile and before building the prompt, add:

```ts
    // Grounding
    let sources: SourceRef[] = [];
    let groundingFailed = false;
    const searchSettings = await loadSearchSettings();
    if (grounded && isSearchConfigured(searchSettings)) {
      try {
        const targetForSearch =
          (input.jobTitle && input.jobTitle.trim()) ||
          (input.jobAdvert && input.jobAdvert.trim().split('\n')[0].slice(0, 100)) ||
          'this role';
        const query = `${targetForSearch} salary skills requirements`;
        sources = await search({ query, intent: 'salary' });
      } catch (err) {
        console.error('[gapAnalysis] search failed:', err);
        groundingFailed = true;
        sources = [];
      }
    }
```

Import `SourceRef`:

```ts
import type { SourceRef } from '@/lib/session-store';
```

Destructure `grounded` from the request body. Thread `sources` into the prompt builder:

```ts
    const userPrompt = buildGapAnalysisPrompt({ ...input, sources });
```

Update the response JSON:

```ts
    return new Response(
      JSON.stringify({ analysis, trimmed, sources, groundingFailed }),
      { status: 200 }
    );
```

- [ ] **Step 2: Update learning path route**

Read `app/api/learningPath/route.ts` first. Same pattern — add imports, extend request type with `grounded`, run search before prompt build:

```ts
    let sources: SourceRef[] = [];
    let groundingFailed = false;
    const searchSettings = await loadSearchSettings();
    if (grounded && isSearchConfigured(searchSettings)) {
      try {
        const targetForSearch =
          (input.jobTitle && input.jobTitle.trim()) ||
          (input.jobAdvert && input.jobAdvert.trim().split('\n')[0].slice(0, 100)) ||
          'this role';
        const topGaps = input.gapAnalysis
          ? input.gapAnalysis.gaps
              .filter((g) => g.severity === 'critical')
              .slice(0, 3)
              .map((g) => g.title)
              .join(' ')
          : '';
        const query = topGaps
          ? `${targetForSearch} courses ${topGaps}`
          : `${targetForSearch} learning path courses certifications`;
        sources = await search({ query, intent: 'course' });
      } catch (err) {
        console.error('[learningPath] search failed:', err);
        groundingFailed = true;
        sources = [];
      }
    }
```

Thread `sources` into the prompt builder:

```ts
    const userPrompt = buildLearningPathPrompt({ ...input, sources });
```

Update the response JSON to include `sources` and `groundingFailed`.

- [ ] **Step 3: Type-check + test**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/gapAnalysis/route.ts app/api/learningPath/route.ts
git commit -m "Ground gap analysis and learning path routes with search results"
```

---

## Task 18: Update /api/interview + /api/chat for grounding

**Files:**
- Modify: `app/api/interview/route.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Update interview route**

Read `app/api/interview/route.ts`. Add imports:

```ts
import { search } from '@/lib/search-service';
import { loadSearchSettings, isSearchConfigured } from '@/lib/search-settings';
import type { SourceRef } from '@/lib/session-store';
```

Inside the POST handler, after the system prompt is built but before the LLM call, add the grounding block (only for role-specific phase):

```ts
    // Grounding — only for role-specific phase
    let sources: SourceRef[] = [];
    let groundingFailed = false;
    if (phase === 'role-specific') {
      const searchSettings = await loadSearchSettings();
      if (isSearchConfigured(searchSettings)) {
        try {
          const query = `${target} interview questions common technical behavioural`;
          sources = await search({ query, intent: 'general' });
        } catch (err) {
          console.error('[interview] search failed:', err);
          groundingFailed = true;
          sources = [];
        }
      }
    }

    // Re-build the system prompt with sources if any
    const systemPromptWithSources = buildInterviewSystemPrompt({
      target,
      difficulty,
      phase,
      turnInPhase,
      sources: sources.length > 0 ? sources : undefined,
    });
```

Use `systemPromptWithSources` instead of the previous `systemPrompt` variable in the `toProviderMessages` call.

Update the response to include `sources` and `groundingFailed`:

```ts
    return new Response(
      JSON.stringify({
        reply,
        nextPhase: next.phase,
        nextTurnInPhase: next.turnInPhase,
        isComplete: next.isComplete,
        trimmed,
        sources,
        groundingFailed,
      }),
      { status: 200 }
    );
```

- [ ] **Step 2: Update chat route for searchSources**

Read `app/api/chat/route.ts`. Add to the `ChatRequest` interface:

```ts
  searchSources?: SourceRef[];
```

Import:

```ts
import { formatSourcesForFootnote } from '@/lib/search-prompt';
import type { SourceRef } from '@/lib/session-store';
```

Destructure `searchSources` from the body.

Inside the message assembly (`toProviderMessages`), extend the existing system context block logic to include search sources when present. Locate the line that pushes the context block into the provider messages and add AFTER it:

```ts
    if (searchSources && searchSources.length > 0) {
      out.push({
        role: 'system' as const,
        content: formatSourcesForFootnote(searchSources),
      });
    }
```

Where `out` is the array being built in `toProviderMessages`. You'll need to pass `searchSources` into `toProviderMessages` as a new parameter — update the function signature accordingly, or inline the push into the POST handler after calling `toProviderMessages`.

The cleaner option: pass `searchSources` as a parameter. Update the signature:

```ts
function toProviderMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  contextBlock: string | null,
  searchSources?: SourceRef[]
) {
  // existing body ...
  if (searchSources && searchSources.length > 0) {
    out.push({
      role: 'system' as const,
      content: formatSourcesForFootnote(searchSources),
    });
  }
  // existing return ...
}
```

And pass `searchSources` at the call site.

- [ ] **Step 3: Type-check + test**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/interview/route.ts app/api/chat/route.ts
git commit -m "Ground interview (role-specific) and chat (opt-in) routes"
```

---

## Task 19: SourcesList + InlineCitation components

**Files:**
- Create: `components/results/SourcesList.tsx`
- Create: `components/results/InlineCitation.tsx`

- [ ] **Step 1: Create `SourcesList.tsx`**

```tsx
'use client';

import { ExternalLink } from 'lucide-react';
import type { SourceRef } from '@/lib/session-store';

type Props = {
  sources: SourceRef[];
  compact?: boolean;
  heading?: string;
};

export default function SourcesList({ sources, compact = false, heading = 'Sources' }: Props) {
  if (sources.length === 0) return null;

  if (compact) {
    return (
      <div className='mt-2 pl-4 border-l-2 border-border'>
        <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
          Sources
        </div>
        <ol className='text-[var(--text-sm)] space-y-0.5'>
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className='flex items-start gap-2'>
              <span className='text-ink-quiet flex-shrink-0'>{i + 1}.</span>
              <a
                href={s.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-ink-muted hover:text-accent underline decoration-dotted inline-flex items-center gap-1 min-w-0'
              >
                <span className='truncate'>{s.title}</span>
                <ExternalLink className='w-3 h-3 flex-shrink-0' />
              </a>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className='border-t border-border pt-6 mt-6'>
      <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-3'>
        {heading}
      </h2>
      <ol className='space-y-2'>
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} id={`source-${i + 1}`} className='flex items-start gap-3'>
            <span className='text-ink-quiet font-medium min-w-[1.5rem]'>
              {i + 1}.
            </span>
            <div className='flex-1 min-w-0'>
              <a
                href={s.url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-ink hover:text-accent underline decoration-dotted inline-flex items-center gap-1.5'
              >
                <span>{s.title}</span>
                <ExternalLink className='w-3.5 h-3.5 flex-shrink-0' />
              </a>
              <div className='text-[var(--text-xs)] text-ink-quiet mt-0.5'>
                {s.domain}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Create `InlineCitation.tsx`**

```tsx
'use client';

import type { SourceRef } from '@/lib/session-store';

type Props = {
  index: number;
  sources: SourceRef[];
};

export default function InlineCitation({ index, sources }: Props) {
  const source = sources[index - 1];

  if (!source) {
    return (
      <sup
        className='text-ink-quiet px-0.5 cursor-help'
        title='Source not found'
      >
        [{index}]
      </sup>
    );
  }

  function handleClick() {
    const el = document.getElementById(`source-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <sup
      onClick={handleClick}
      className='text-accent px-0.5 cursor-pointer hover:underline'
      title={source.title}
    >
      [{index}]
    </sup>
  );
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/results/SourcesList.tsx components/results/InlineCitation.tsx
git commit -m "Add SourcesList (compact + full) and InlineCitation components"
```

---

## Task 20: UrlInputField + InputsZone integration

**Files:**
- Create: `components/landing/UrlInputField.tsx`
- Modify: `components/landing/InputsZone.tsx`

- [ ] **Step 1: Create `UrlInputField.tsx`**

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
  const [fetchedInto, setFetchedInto] = useState<'jobAdvert' | 'freeText' | null>(
    store.urlFetchedTitle ? 'jobAdvert' : null
  );
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(
    store.urlFetchedTitle
  );

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
      const { text, fetchedTitle: title, classifiedAs } = (await res.json()) as {
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
  }

  return (
    <div className='w-full'>
      <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
        URL (optional)
      </label>
      <div className='relative'>
        <LinkIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-quiet pointer-events-none' />
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

- [ ] **Step 2: Integrate into `InputsZone`**

Read `components/landing/InputsZone.tsx`. Add the import at the top:

```tsx
import UrlInputField from './UrlInputField';
```

In the JSX, locate the root container. The current structure is something like:

```tsx
<div className='w-full max-w-5xl space-y-4'>
  {missingHints.message && (...)}
  <div className='grid md:grid-cols-2 gap-4'>
    {/* Resume + three stacked fields */}
  </div>
</div>
```

Add the `<UrlInputField />` as a new row BEFORE the grid:

```tsx
<div className='w-full max-w-5xl space-y-4'>
  {missingHints.message && (...)}
  <UrlInputField />
  <div className='grid md:grid-cols-2 gap-4'>
    {/* existing grid unchanged */}
  </div>
</div>
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/landing/UrlInputField.tsx components/landing/InputsZone.tsx
git commit -m "Add URL input field above landing grid with fetch-on-blur"
```

---

## Task 21: ActionsZone passes grounded flag

**Files:**
- Modify: `components/landing/ActionsZone.tsx`

- [ ] **Step 1: Read current file and add the grounding check**

Read `components/landing/ActionsZone.tsx`. Add the import:

```tsx
import { settingsStore } from '@/lib/settings-store';
```

The client can't call `lib/search-settings.ts` directly (it depends on `secureStorage` which is ok in the renderer, but the module is structured for server use). Simpler approach: the client reads `searchEngine` from `settingsStore.get()` and passes a boolean to the route.

Near the top of the component (or inside the relevant handler), read the search engine and derive `grounded`:

Inside `handleGapAnalysis`, before the `fetch('/api/gapAnalysis', ...)` call, add:

```ts
      const settings = await settingsStore.get();
      const grounded = (settings.searchEngine ?? 'duckduckgo') !== 'disabled';
```

Then add `grounded` to the request body. Same pattern in `handleLearningPath`.

For the interview action, no change is needed — the interview route decides grounding internally based on the server-side `loadSearchSettings`, independent of the client's decision. It already handles that. (Wait — actually the interview route only checks when `phase === 'role-specific'`. That's server-side, so no client flag needed. Leave the action unchanged.)

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/landing/ActionsZone.tsx
git commit -m "Pass grounded flag to gap analysis and learning path actions"
```

---

## Task 22: GapAnalysisView + LearningPathView + InterviewFeedbackView integration

**Files:**
- Modify: `components/results/GapAnalysisView.tsx`
- Modify: `components/results/LearningPathView.tsx`
- Modify: `components/interview/InterviewFeedbackView.tsx`
- Modify: `components/interview/InterviewChat.tsx`

- [ ] **Step 1: GapAnalysisView — inline citations + sources list + fallback + disclaimer**

Read `components/results/GapAnalysisView.tsx`. Add imports:

```tsx
import SourcesList from './SourcesList';
import InlineCitation from './InlineCitation';
import { useSessionStore } from '@/lib/session-store';
import { segmentCitations, hasAnyCitations } from '@/lib/citation-detect';
```

Read sources from the store:

```tsx
const sources = useSessionStore((s) => s.gapAnalysisSources) ?? [];
```

Create a helper inside the component file (or inline in the JSX) that renders text with citation markers wrapped in `<InlineCitation>`:

```tsx
function renderWithCitations(text: string, sources: SourceRef[]) {
  const segments = segmentCitations(text);
  return segments.map((seg, i) => {
    if (seg.kind === 'text') return <span key={i}>{seg.value}</span>;
    return <InlineCitation key={i} index={seg.index} sources={sources} />;
  });
}
```

Import `SourceRef` at the top:

```tsx
import type { SourceRef } from '@/lib/session-store';
```

Use the helper to render `analysis.summary`, each gap's `why`, and `analysis.realisticTimeline`. For example, the Summary section changes from:

```tsx
<p className='text-ink-muted leading-relaxed'>{analysis.summary}</p>
```

to:

```tsx
<p className='text-ink-muted leading-relaxed'>
  {renderWithCitations(analysis.summary, sources)}
</p>
```

Same for the timeline line and each `gap.why` inside `GapItem` expanded content. For `GapItem`, since it's a separate component, either pass `sources` and a renderer function as a prop, or wrap its content in the parent view. The simplest option: move the `renderWithCitations` call into `GapAnalysisView` and pass the already-rendered nodes via a new prop to `GapItem`. That changes `GapItem`'s interface though. Instead, pass `sources` as a prop to `GapItem` and let it import `segmentCitations` + `InlineCitation` directly:

```tsx
// GapItem prop type addition
type Props = {
  gap: Gap;
  expanded: boolean;
  onToggle: () => void;
  sources?: SourceRef[];
};
```

And inside `GapItem`, wrap the `why` text (and optionally `targetLevel`, `currentLevel`) with a local `renderWithCitations`. Keep the helper inline in each file — it's small.

At the bottom of `GapAnalysisView`, before the chain/action row, add:

```tsx
{sources.length > 0 && (
  <>
    {(() => {
      const hasMarkers =
        hasAnyCitations(analysis.summary) ||
        analysis.gaps.some(
          (g) => hasAnyCitations(g.why) || hasAnyCitations(g.targetLevel)
        ) ||
        hasAnyCitations(analysis.realisticTimeline);
      if (!hasMarkers) {
        return (
          <div className='mb-4 border border-accent/30 bg-accent-soft rounded-lg px-4 py-3 text-[var(--text-sm)] text-ink'>
            The AI didn't tag specific claims with citation markers — the sources used for this analysis are listed below for your reference.
          </div>
        );
      }
      return null;
    })()}
    <SourcesList sources={sources} />
    <p className='text-[var(--text-xs)] text-ink-quiet italic mt-2'>
      AI-cited sources. Small or local models may occasionally misattribute a
      claim — click through to verify anything you plan to act on.
    </p>
  </>
)}
```

Also update the `CopyMarkdownButton` so the markdown export includes the sources:

```tsx
<CopyMarkdownButton getMarkdown={() => gapAnalysisToMarkdown(analysis, sources)} />
```

- [ ] **Step 2: LearningPathView — sources list**

Read `components/results/LearningPathView.tsx`. Add imports:

```tsx
import SourcesList from './SourcesList';
import { useSessionStore } from '@/lib/session-store';
```

Read sources:

```tsx
const sources = useSessionStore((s) => s.learningPathSources) ?? [];
```

At the bottom of the view, before the action row, add:

```tsx
{sources.length > 0 && <SourcesList sources={sources} />}
```

Update the Copy Markdown button:

```tsx
<CopyMarkdownButton getMarkdown={() => learningPathToMarkdown(path, sources)} />
```

- [ ] **Step 3: InterviewFeedbackView — sources list**

Read `components/interview/InterviewFeedbackView.tsx`. Add imports:

```tsx
import SourcesList from '@/components/results/SourcesList';
```

Read sources:

```tsx
const interviewSources = useSessionStore((s) => s.interviewSources);
```

Before the bottom action row, add:

```tsx
{interviewSources.length > 0 && (
  <SourcesList sources={interviewSources} heading='Sources consulted during this interview' />
)}
```

Update the Copy Markdown button:

```tsx
<CopyMarkdownButton
  getMarkdown={() => interviewFeedbackToMarkdown(feedback, interviewSources)}
/>
```

- [ ] **Step 4: InterviewChat — collect sources from responses**

Read `components/interview/InterviewChat.tsx`. Locate `handleSend`. After the successful response destructure that reads `reply, nextPhase, nextTurnInPhase, isComplete`, add:

```ts
      const data = (await res.json()) as {
        reply: string;
        nextPhase: InterviewPhase | null;
        nextTurnInPhase: number;
        isComplete: boolean;
        sources?: SourceRef[];
      };
      if (data.sources && data.sources.length > 0) {
        store.addInterviewSources(data.sources);
      }
```

Adjust the destructure so you read `data.reply`, `data.nextPhase`, etc. Import `SourceRef` at the top.

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/results/GapAnalysisView.tsx components/results/LearningPathView.tsx components/interview/InterviewFeedbackView.tsx components/interview/InterviewChat.tsx components/results/GapItem.tsx
git commit -m "Render sources in gap / learning / interview views + inline citations

GapAnalysisView renders [n] citations via segmentCitations +
InlineCitation, falls back to plain source list if the model
didn't emit markers, and shows the small-model disclaimer.
LearningPathView and InterviewFeedbackView render full SourcesList.
InterviewChat accumulates sources from each role-specific turn."
```

---

## Task 23: LookUpButton + ChatComposer + ChatMessageList + chat page wiring

**Files:**
- Create: `components/chat/LookUpButton.tsx`
- Modify: `components/chat/ChatComposer.tsx`
- Modify: `components/chat/ChatMessageList.tsx`
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Create `LookUpButton.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  onLookUp: (query: string) => void;
  disabled?: boolean;
};

export default function LookUpButton({ onLookUp, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onLookUp(trimmed);
    setQuery('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        type='button'
        variant='outline'
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label='Look something up on the web'
        title='Look something up on the web'
      >
        <Search className='w-4 h-4' />
      </Button>
    );
  }

  return (
    <div className='flex items-center gap-2 flex-1'>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
        placeholder='What should I look up?'
      />
      <Button type='button' onClick={handleSubmit} disabled={!query.trim()}>
        Search
      </Button>
      <Button
        type='button'
        variant='outline'
        onClick={() => {
          setOpen(false);
          setQuery('');
        }}
        aria-label='Cancel'
      >
        <X className='w-4 h-4' />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update `ChatComposer` to accept `onLookUp`**

Read `components/chat/ChatComposer.tsx`. Add to `Props`:

```tsx
type Props = {
  onSend: (text: string) => void;
  onPaperclip?: () => void;
  onLookUp?: (query: string) => void;
  disabled?: boolean;
};
```

Import the new component:

```tsx
import LookUpButton from './LookUpButton';
```

In the JSX, add `<LookUpButton />` next to the paperclip button. If `onLookUp` is undefined, don't render the button. Place it between the paperclip and the text input so the button row reads: [paperclip?] [look up?] [textarea] [send].

```tsx
{onLookUp && <LookUpButton onLookUp={onLookUp} disabled={disabled} />}
```

- [ ] **Step 3: Update `ChatMessageList` to render per-message sources**

Read `components/chat/ChatMessageList.tsx`. Add imports:

```tsx
import SourcesList from '@/components/results/SourcesList';
import { useSessionStore } from '@/lib/session-store';
```

Read chat sources from the store:

```tsx
const chatSources = useSessionStore((s) => s.chatSources);
```

In the message rendering loop, after each assistant `message` bubble, render the sources list if present:

```tsx
{m.role === 'assistant' && chatSources[m.id] && chatSources[m.id].length > 0 && (
  <SourcesList sources={chatSources[m.id]} compact />
)}
```

Place this INSIDE the message list div, after the bubble `<div>`, so it appears beneath the assistant message.

- [ ] **Step 4: Wire up `onLookUp` in `app/chat/page.tsx`**

Read `app/chat/page.tsx`. Add imports:

```tsx
import type { SourceRef } from '@/lib/session-store';
```

Inside `ChatPage`, add a `handleLookUp` handler that:
1. Runs `POST /api/chatSearch { query }` to get sources
2. Runs the normal `handleSend(query)` flow but with `searchSources` included in the `/api/chat` body
3. After the assistant reply is added to the store, call `store.setChatSourcesForMessage(messageId, sources)` for the new message

Since `handleSend` doesn't currently accept a `searchSources` parameter, extend it:

```ts
async function handleSend(text: string, searchSources?: SourceRef[]) {
  // existing body, but include searchSources in the /api/chat body if present
  // ...
  body: JSON.stringify({
    messages: currentMessages,
    currentFocus: useSessionStore.getState().currentFocus,
    resumeText: useSessionStore.getState().resumeText,
    freeText: useSessionStore.getState().freeText,
    jobTitle: useSessionStore.getState().jobTitle,
    jobAdvert: useSessionStore.getState().jobAdvert,
    searchSources,
    llmConfig,
  }),
}
```

Then add the look-up handler:

```ts
async function handleLookUp(query: string) {
  try {
    const res = await fetch('/api/chatSearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('Look-up failed');
    const { results } = (await res.json()) as { results: SourceRef[] };

    // Run a normal send with the user's query AND the fetched sources as context
    await handleSend(query, results);

    // After handleSend completes, the most recent assistant message is the one
    // that used the sources. Tag it.
    const latestMessages = useSessionStore.getState().chatMessages;
    const lastAssistant = [...latestMessages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant && results.length > 0) {
      store.setChatSourcesForMessage(lastAssistant.id, results);
    }
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Look-up failed');
  }
}
```

Pass `handleLookUp` to `ChatComposer`:

```tsx
<ChatComposer
  onSend={handleSend}
  onPaperclip={() => setPaperclipOpen(true)}
  onLookUp={handleLookUp}
  disabled={sending}
/>
```

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/chat/LookUpButton.tsx components/chat/ChatComposer.tsx components/chat/ChatMessageList.tsx app/chat/page.tsx
git commit -m "Add chat opt-in look-up with per-message source list"
```

---

## Task 24: Settings page — Research & Grounding section + About page update

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `app/about/page.tsx`

- [ ] **Step 1: Read current settings page**

Read `app/settings/page.tsx` to understand its structure (existing LLM provider section, save handler, settings store integration).

- [ ] **Step 2: Add Research & Grounding section**

Below the existing "Preferences" / LLM section but above the Save / Reset buttons, add a new section:

```tsx
{/* Research & Grounding */}
<div>
  <div className='editorial-rule'>
    <span>Research & Grounding</span>
  </div>
  <h2 className='text-[var(--text-2xl)] font-semibold text-ink mb-2'>
    Web search
  </h2>
  <p className='text-ink-muted mb-6 text-[var(--text-sm)]'>
    Grounding fetches current web data to back up gap analysis, learning
    paths, and interview questions. Disable if you prefer fully offline.
  </p>

  <div className='space-y-2'>
    {(['disabled', 'duckduckgo', 'brave', 'bing', 'serper', 'searxng'] as const).map((eng) => (
      <label key={eng} className='flex items-start gap-3 cursor-pointer'>
        <input
          type='radio'
          name='searchEngine'
          value={eng}
          checked={searchEngine === eng}
          onChange={() => setSearchEngine(eng)}
          className='mt-1'
        />
        <div>
          <div className='text-ink font-medium'>{SEARCH_ENGINE_LABEL[eng]}</div>
          <div className='text-[var(--text-sm)] text-ink-muted'>
            {SEARCH_ENGINE_DESCRIPTION[eng]}
          </div>
        </div>
      </label>
    ))}
  </div>

  {(searchEngine === 'brave' || searchEngine === 'bing' || searchEngine === 'serper') && (
    <div className='mt-4'>
      <Label>API key</Label>
      <Input
        type='password'
        value={searchApiKey}
        onChange={(e) => setSearchApiKey(e.target.value)}
        placeholder={`Your ${searchEngine} API key`}
      />
    </div>
  )}

  {searchEngine === 'searxng' && (
    <div className='mt-4'>
      <Label>SearXNG URL</Label>
      <Input
        value={searchUrl}
        onChange={(e) => setSearchUrl(e.target.value)}
        placeholder='https://your-searxng-instance.example.com'
      />
    </div>
  )}

  <div className='mt-4'>
    <Button variant='outline' onClick={handleTestSearch} disabled={testingSearch}>
      {testingSearch ? 'Testing…' : 'Test search'}
    </Button>
  </div>

  <div className='mt-6 p-4 border border-border rounded-lg bg-paper-warm'>
    <p className='text-[var(--text-sm)] text-ink-muted'>
      <strong className='text-ink'>Privacy note.</strong> Search queries leave
      your device. Career Compass never sends your resume or chat content to
      the search engine — only the derived query (e.g., "Data Analyst Perth
      salary").
    </p>
  </div>
</div>
```

Add the constants at the top of the file (outside the component):

```tsx
const SEARCH_ENGINE_LABEL: Record<SearchEngine, string> = {
  disabled: 'Disabled — no web search',
  duckduckgo: 'DuckDuckGo — free, no setup',
  brave: 'Brave Search — free tier 2000/month',
  bing: 'Bing — paid',
  serper: 'Serper (Google) — paid',
  searxng: 'SearXNG — self-hosted',
};

const SEARCH_ENGINE_DESCRIPTION: Record<SearchEngine, string> = {
  disabled: 'All grounding is off. Career Compass runs offline for AI calls.',
  duckduckgo: 'Default. HTML scraping of the DuckDuckGo lite page.',
  brave: 'Needs an API key. Reliable and reasonably generous free tier.',
  bing: 'Needs an API key. Pay per query.',
  serper: 'Google results via Serper. Needs an API key.',
  searxng: 'Point to your own SearXNG instance URL.',
};
```

Import the types and state hooks at the top of the file:

```tsx
import type { SearchEngine } from '@/lib/settings-store';
```

Add state and handlers inside the component:

```tsx
const [searchEngine, setSearchEngine] = useState<SearchEngine>('duckduckgo');
const [searchApiKey, setSearchApiKey] = useState('');
const [searchUrl, setSearchUrl] = useState('');
const [testingSearch, setTestingSearch] = useState(false);
```

In the existing settings-load `useEffect` (which reads settings on mount), add:

```ts
setSearchEngine(saved.searchEngine ?? 'duckduckgo');
setSearchUrl(saved.searchUrl ?? '');
if (saved.searchEngine === 'brave' || saved.searchEngine === 'bing' || saved.searchEngine === 'serper') {
  const key = await secureStorage.getSearchApiKey(saved.searchEngine);
  setSearchApiKey(key ?? '');
}
```

In the existing save handler, after saving LLM settings, add:

```ts
await settingsStore.set({
  ...saved,
  searchEngine,
  searchUrl,
});
if (searchEngine === 'brave' || searchEngine === 'bing' || searchEngine === 'serper') {
  await secureStorage.setSearchApiKey(searchEngine, searchApiKey);
}
```

Add the Test search handler:

```ts
async function handleTestSearch() {
  setTestingSearch(true);
  try {
    // Save current settings first so the route sees them
    await settingsStore.set({
      ...(await settingsStore.get()),
      searchEngine,
      searchUrl,
    });
    if (searchEngine === 'brave' || searchEngine === 'bing' || searchEngine === 'serper') {
      await secureStorage.setSearchApiKey(searchEngine, searchApiKey);
    }

    const res = await fetch('/api/getSources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'career compass test query', intent: 'general' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Search test failed');
    }
    const { results } = (await res.json()) as { results: unknown[] };
    toast.success(`Search working — ${results.length} results returned.`);
  } catch (err) {
    console.error(err);
    toast.error(err instanceof Error ? err.message : 'Search test failed');
  } finally {
    setTestingSearch(false);
  }
}
```

- [ ] **Step 3: Update About page privacy bullet**

Read `app/about/page.tsx`. Find the privacy commitment section with the "No data collection" bullet. Replace that bullet's text with:

```tsx
<span>
  No data collection. Your files are processed entirely on your device. The
  only outbound traffic is to your configured AI provider and, if enabled,
  your configured search engine. Search queries are derived from your
  inputs, never the full text.
</span>
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add app/settings/page.tsx app/about/page.tsx
git commit -m "Add Research & Grounding settings section and update privacy bullet"
```

---

## Task 25: Manual QA

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all PASS. ~200+ tests across all existing + new modules.

- [ ] **Step 2: Run the type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Walk the manual QA checklist in the Electron dev build**

Run: `npm run electron:dev`

- [ ] Fresh install: settings shows DuckDuckGo as default
- [ ] Fresh install: run grounded gap analysis without any settings action → sources section appears
- [ ] Settings: switch to Brave with no key → Test search fails gracefully with helpful error
- [ ] Settings: switch to Brave with a valid key → Test search success toast
- [ ] Settings: switch to SearXNG with no URL → Test search fails gracefully
- [ ] Settings: switch to Disabled → save → grounded features run without sources sections
- [ ] Gap analysis with grounding: inline `[1]`, `[2]` markers visible in summary / why / timeline
- [ ] Gap analysis citation click: scrolls to the correct source entry
- [ ] Gap analysis with a small model that didn't emit markers: fallback notice appears above sources
- [ ] Copy as Markdown from gap analysis: preserves `[n]` markers AND includes ## Sources section
- [ ] Gap analysis → same target again → terminal log shows cache hit on second run
- [ ] Learning path with grounding: footnote list at bottom, no inline markers in the milestone body
- [ ] Learning path Copy as Markdown: includes ## Sources
- [ ] Interview role-specific phase first turn: terminal log shows search being fired
- [ ] Interview role-specific second turn: terminal log shows cache hit
- [ ] Interview feedback panel: "Sources consulted during this interview" section present when role-specific was reached
- [ ] Interview feedback: section absent when ended before role-specific
- [ ] Interview feedback Copy as Markdown: includes ## Sources consulted
- [ ] Chat: click Look this up button → prompt appears → enter query → sources render under next assistant message
- [ ] Chat: multiple look-ups → each assistant message shows its own sources
- [ ] Landing: paste a Seek URL → fetched, populated into Job advert, status chip shows
- [ ] Landing: paste a LinkedIn profile URL → LinkedIn-blocked error toast, field keeps value
- [ ] Landing: paste a GitHub URL → fetched into About you
- [ ] Landing: paste a random article URL → classified unknown, routed to Job advert
- [ ] URL status chip clear button → removes chip, target field content unchanged
- [ ] Gap analysis with network disconnect → groundingFailed notice, analysis still works
- [ ] Gap analysis with searchEngine: disabled → no sources section, no fallback notice, no disclaimer
- [ ] Privacy note visible in settings search section
- [ ] About page updated bullet visible
- [ ] Header and footer pinned on every page; pages scroll their own content (regression check)
- [ ] Window can be dragged on macOS (regression check)
- [ ] Electron dev build works end to end (`npm run electron:dev`)

- [ ] **Step 4: Commit any fixes**

If any QA item fails and you fix it, commit each fix with a short message like `Fix: <description>`.

- [ ] **Step 5: Final commit (only if no fixes were needed)**

If everything passed, no additional commit needed — Phase 3 is complete.

---

## Self-review — spec coverage

| Spec requirement | Task |
|---|---|
| `SourceRef` type + new session store fields/actions + `resetInterview` clears `interviewSources` | Task 1 |
| `SettingsConfig` extension + namespaced `secureStorage` refactor | Task 2 |
| `lib/search-intent.ts` with 4 intents and site filters | Task 3 |
| `lib/search-cache.ts` with 50-entry LRU | Task 4 |
| `lib/search-prompt.ts` — footnote + inline-cite formatters | Task 5 |
| `lib/citation-detect.ts` — `segmentCitations` / `hasAnyCitations` | Task 6 |
| `lib/url-classify.ts` — URL → classification patterns | Task 7 |
| `lib/search-settings.ts` — `loadSearchSettings` + `isSearchConfigured` | Task 8 |
| `lib/url-fetch.ts` — readability extract + `UrlFetchError` | Task 9 |
| `app/api/getSources/route.ts` + `lib/search-service.ts` port from Study Buddy | Task 10 |
| `app/api/fetchUrl/route.ts` | Task 11 |
| `app/api/chatSearch/route.ts` | Task 12 |
| `buildGapAnalysisPrompt` accepts `sources` with inline-cite | Task 13 |
| `buildLearningPathPrompt` accepts `sources` with footnote | Task 14 |
| `buildInterviewSystemPrompt` accepts `sources`, role-specific only | Task 15 |
| Markdown exporters accept `sources` and render a Sources section | Task 16 |
| `/api/gapAnalysis` and `/api/learningPath` grounding | Task 17 |
| `/api/interview` role-specific grounding + `/api/chat` searchSources | Task 18 |
| `SourcesList` (compact + full) + `InlineCitation` | Task 19 |
| `UrlInputField` + `InputsZone` integration | Task 20 |
| `ActionsZone` passes `grounded` flag | Task 21 |
| `GapAnalysisView` citation rendering + fallback + disclaimer; `LearningPathView` + `InterviewFeedbackView` source lists; `InterviewChat` source collection | Task 22 |
| `LookUpButton` + `ChatComposer` + `ChatMessageList` + chat page wiring | Task 23 |
| Settings Research & Grounding section + Test search button + About page bullet | Task 24 |
| Manual QA | Task 25 |

No gaps. Type names are consistent throughout: `SourceRef`, `SearchEngine`, `SearchIntent`, `SearchSettings`, `UrlClassification`, `UrlFetchError`. Prop names match between component callers and definitions.
