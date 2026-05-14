# Phase 3 — Per-Page Ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Port all 18 pages from `app/<route>/page.tsx` (Next.js, with API routes that don't ship in production) to `src/renderer/pages/<Route>.tsx` (Vite, calling main-process IPC for HTTP and file parsing). After Phase 3, the packaged app is functionally complete — every Home card opens a working page.

**Architecture:** Per the Phase 3 architecture decision (2026-05-14), LLM orchestration stays in the renderer; main process only handles the HTTP call via `window.electronAPI.apiFetch`. A single shared `src/renderer/services/llm.ts` reads settings + API keys via existing IPC and constructs provider requests. File parsing already lives in main (Phase 2). The original `app/`, `electron/`, and route handlers stay on disk until Phase 4.

**Tech Stack:** No new deps. Uses existing react-router-dom 6, zustand stores, lucide-react icons, ReactFlow, Tailwind tokens, and the Phase 2 IPC handlers.

**Out of scope for Phase 3:** deleting any legacy files (Phase 4), notarisation (Phase 5), refactoring zustand stores, redesigning UI.

**Acceptance criteria:**
- All 18 routes resolve to a real page (not `NotMigrated`). The Home page's `ported: true` flag is set on every card.
- Each page's primary action works end-to-end in BOTH dev and packaged builds.
- 381+ existing tests still pass. New tests added where the page involves non-trivial logic (llm.ts service, file upload helpers).
- The packaged `.app` (`npm run electron:pack`) launches and exercises at least 3 pages without errors.

---

## Setup Task

### Task 1: Renderer LLM + file-upload service

**Files:**
- Create: `src/renderer/services/llm.ts`
- Create: `src/renderer/services/llm.test.ts`
- Create: `src/renderer/services/file-upload.ts`
- Create: `src/renderer/services/file-upload.test.ts`

The whole point of Phase 3 is that every LLM page ports the same way. This task builds the shared abstraction those ports depend on.

- [ ] **Step 1: Inspect existing `lib/llm-providers.ts`**

Read `/Users/michael/Projects/career-compass/lib/llm-providers.ts`. Note the interface: `LLMProvider.chat({ messages, model, temperature, response_format })`. Note how the existing code constructs the OpenAI-compatible URL per provider:

- Ollama: `${baseURL}/v1/chat/completions` (baseURL is `http://localhost:11434/v1`)
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Anthropic: `https://api.anthropic.com/v1/messages` (DIFFERENT shape — see below)
- Groq: `https://api.groq.com/openai/v1/chat/completions`
- Gemini: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<key>` (different shape)
- OpenRouter: `https://openrouter.ai/api/v1/chat/completions`

Most providers use the OpenAI shape. Anthropic and Gemini have their own shapes. Don't reinvent — the existing `lib/llm-providers.ts` already handles this; the new service can either delegate to it or copy its shape logic.

**Recommended approach:** the new `llm.ts` calls the existing `lib/llm-providers.ts` functions BUT injects the `apiFetch` to override the SDK's fetch where possible. If that's too convoluted (the OpenAI SDK doesn't always expose a fetch override cleanly), the simpler path is to skip the SDK and build raw requests for each provider. Pick whichever path is cleaner after reading the existing code.

- [ ] **Step 2: Create `src/renderer/services/llm.ts`**

Interface (do NOT use an SDK in the renderer — talk to providers via raw apiFetch):

```typescript
// Provider-agnostic LLM chat client. Reads settings + API key via existing
// IPC bridges, constructs the right request shape per provider, and routes
// the HTTP call through window.electronAPI.apiFetch (CORS-free).

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatOptions = {
  messages: ChatMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' } | { type: 'text' };
  maxTokens?: number;
};

export type ChatResult = {
  content: string;
  // Provider-reported usage if available, else undefined
  usage?: { promptTokens: number; completionTokens: number };
};

export async function chat(options: ChatOptions): Promise<ChatResult> {
  // 1. Read settings: provider, baseURL, model
  const settings = await window.electronAPI.store.get<{
    provider: string;
    baseURL: string;
    model: string;
  }>('settings', { provider: 'ollama', baseURL: 'http://localhost:11434/v1', model: '' });

  // 2. Read API key from secureStorage (per-provider key name)
  const keyName = settings.provider === 'ollama' ? null : `${settings.provider}-api-key`;
  const apiKey = keyName ? await window.electronAPI.secureStorage.getPassword(keyName) : null;

  // 3. Build provider-specific request
  const req = buildProviderRequest(settings.provider, settings.baseURL, settings.model, apiKey, options);

  // 4. Call via apiFetch
  const resp = await window.electronAPI.apiFetch(req);

  if (!resp.ok) {
    throw new LLMError(
      `${settings.provider} returned ${resp.status}: ${resp.statusText}`,
      resp.status,
      resp.body
    );
  }

  // 5. Parse provider-specific response shape
  return parseProviderResponse(settings.provider, resp.body);
}

// ... buildProviderRequest, parseProviderResponse, LLMError class
```

Implement `buildProviderRequest` and `parseProviderResponse` for all 6 providers. Reference `lib/llm-providers.ts` for the exact shapes. The Anthropic shape needs:
- URL: `https://api.anthropic.com/v1/messages`
- Headers: `anthropic-version: 2023-06-01`, `x-api-key: <key>`, `content-type: application/json`
- Body: `{model, max_tokens, system: <extracted>, messages: <rest>}`  (Anthropic separates system into its own field)
- Response: `{content: [{type: 'text', text: <string>}]}`

The Gemini shape needs:
- URL: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<apiKey>`
- Body: `{contents: [{role: 'user', parts: [{text: ...}]}], systemInstruction: {parts: [{text: ...}]}}`
- Response: `{candidates: [{content: {parts: [{text: <string>}]}}]}`

- [ ] **Step 3: Write `src/renderer/services/llm.test.ts`**

Don't test against real providers (no network in CI). Mock `window.electronAPI` and verify:
- buildProviderRequest constructs the right URL/headers/body for each of the 6 providers
- parseProviderResponse extracts content correctly for each provider's response shape
- LLMError is thrown on non-ok responses

Vitest mock pattern:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  (globalThis as any).window = {
    electronAPI: {
      store: { get: vi.fn(async () => ({ provider: 'openai', baseURL: '', model: 'gpt-4' })) },
      secureStorage: { getPassword: vi.fn(async () => 'sk-test') },
      apiFetch: vi.fn(async () => ({ ok: true, status: 200, body: '{"choices":[{"message":{"content":"hi"}}]}' })),
    },
  };
});
```

- [ ] **Step 4: Create `src/renderer/services/file-upload.ts`**

Wrapper that turns a browser `File` into extracted text by dispatching on extension to the right IPC handler. Markdown is browser-safe (no Node lib needed):

```typescript
import { normalizeText } from './text';  // see Step 5

export type FileUploadResult = { text: string; filename: string };

export async function extractTextFromFile(file: File): Promise<FileUploadResult> {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (ext === '.pdf') {
    const text = await window.electronAPI.parsePdf(bytes);
    return { text, filename: file.name };
  }
  if (ext === '.docx' || ext === '.doc') {
    const text = await window.electronAPI.parseDocx(bytes);
    return { text, filename: file.name };
  }
  if (ext === '.md' || ext === '.markdown' || ext === '.txt') {
    const text = normalizeText(new TextDecoder('utf-8').decode(bytes));
    return { text, filename: file.name };
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

export function isSupportedFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ['.pdf', '.docx', '.doc', '.md', '.markdown', '.txt'].includes(ext);
}
```

- [ ] **Step 5: Port `normalizeText` to a tiny renderer service**

The renderer needs the same `normalizeText` as the main process (already in `src/main/services/file-processors.js`). Create `src/renderer/services/text.ts`:

```typescript
export function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
}
```

Don't import from `lib/utils.ts` — that file has Next-isms (`customAlphabet` from nanoid, etc.) we don't want to drag in piecemeal. Phase 4 deletes `lib/utils.ts`; the renderer side gets its own copy of the small helpers it actually uses.

- [ ] **Step 6: Write `src/renderer/services/file-upload.test.ts`**

Mock `window.electronAPI.parsePdf` / `parseDocx`. Test:
- `extractTextFromFile` dispatches `.pdf` → `parsePdf`, `.docx` → `parseDocx`, `.md` → local TextDecoder.
- `extractTextFromFile` throws on unsupported extension.
- `isSupportedFile` returns true/false correctly.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: 381 baseline + new tests for llm.ts (6+ tests) + file-upload.ts (4+ tests). Should land in the 390s.

- [ ] **Step 8: Process-level smoke**

`npm run electron:dev` background. Confirm clean Vite + Electron start. Kill.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/services/
git commit -m "feat(renderer): llm.ts + file-upload services for phase 3 ports"
```

---

## Per-Page Tasks

Each page port follows the same pattern. For each page in the checklist below:

### Per-page port template

1. **Read** `app/<route>/page.tsx` and any associated `app/api/<route>/route.ts`.
2. **Identify dependencies**: imports from `components/`, `lib/`, zustand stores. Most should transfer unchanged — they live in directories Tailwind already scans (`components/**`, `lib/**`).
3. **Create** `src/renderer/pages/<Route>.tsx`:
   - Replace `'use client';` directives — delete them. Vite doesn't have RSC.
   - Replace `import { useRouter } from 'next/navigation'` → `import { useNavigate } from 'react-router-dom'` and use `const navigate = useNavigate(); navigate('/path')`.
   - Replace `import Link from 'next/link'` → `import { Link } from 'react-router-dom'`.
   - Replace `fetch('/api/<x>', {body: JSON.stringify(input), ...})` → import `chat` from `@/services/llm` (or similar) and call it directly, after porting the route handler's prompt-building logic INTO the page component (or a small sibling service file if the prompt logic is reused).
   - For pages with file upload: import `extractTextFromFile` from `@/services/file-upload`.
4. **Wire** the route into `src/renderer/App.tsx`: add a `<Route path="/<route>" element={<Page />} />` BEFORE the wildcard catchall.
5. **Update** `src/renderer/pages/Home.tsx`: flip `ported: true` on the corresponding card. The opacity-70 dim + stub badge will go away automatically.
6. **Smoke test** (process-level via `npm run electron:dev`): navigate to the route in the dev window, verify the page loads (human verifies).
7. **Commit**: `feat(renderer): port <page name>`

### Page checklist (priority order — simplest first)

| # | Page slug | Path | Complexity | Notes |
|---|---|---|---|---|
| 2 | `settings` | `/settings` | Trivial — no LLM | Uses existing `store`, `secureStorage`, `models` IPC. Phase 3's first real port. |
| 3 | `about` | `/about` | Trivial — static | No LLM, no IPC. Pure content + design tokens. |
| 4 | `pitch` | `/pitch` | Simple LLM | One call, prompt build + result parse. Reference for the LLM-page pattern. |
| 5 | `cover-letter` | `/cover-letter` | Simple LLM | Same shape as pitch. |
| 6 | `gap-analysis` | `/gap-analysis` | Simple LLM | Needs profile + target inputs. |
| 7 | `learning-path` | `/learning-path` | Simple LLM | Profile + target. |
| 8 | `values` | `/values` | Simple LLM | Values compass. |
| 9 | `board` | `/board` | Simple LLM | Board of advisors — single call, response has 4 personas. |
| 10 | `industry` | `/industry` | Simple LLM | Industry exploration. |
| 11 | `skills-mapping` | `/skills-mapping` | Simple LLM | Frameworks (SFIA, O*NET, ESCO, AQF). |
| 12 | `compare` | `/compare` | Simple LLM | Side-by-side comparison. |
| 13 | `career-story` | `/career-story` | Medium | Single call but pulls heavily from session store. |
| 14 | `resume-review` | `/resume-review` | Medium | Adds file upload via `extractTextFromFile`. |
| 15 | `portfolio` | `/portfolio` | Medium | File upload optional, generates personal site content. |
| 16 | `odyssey` | `/odyssey` | Medium | 2-stage: suggest 3 lives, then elaborate each. Two LLM calls. |
| 17 | `interview` | `/interview` | Complex | Multi-turn conversation state. |
| 18 | `chat` | `/chat` | Most complex | **Streaming decision needed.** See note below. |
| 19 | `careers` | `/careers` | Most complex | 2-stage workflow + ReactFlow visualisation. See note below. |

### Special-case notes

**Chat streaming (#18):** The existing `/api/chat/route.ts` uses OpenAI's `stream: true` with Server-Sent Events. The current `api:fetch` IPC handler does NOT support streaming — it buffers the entire response. Options:
1. **Non-streaming first**: port chat with `stream: false`. User waits for full response. Easier port; UX is worse for long responses.
2. **Extend api:fetch with streaming**: add a new IPC channel `api:fetchStream` that emits chunks via `webContents.send`. Renderer subscribes. Significantly more code.

Recommendation: option 1 for the initial port. Capture option 2 as a Phase 5+ follow-up. Document the regression in the chat page port commit message.

**Find my careers (#19):** The existing `app/api/getCareers/route.ts` is a 2-stage LLM workflow (initial 6 career suggestions, then detailed analysis per career). The page also uses ReactFlow for visualisation. The ReactFlow integration is purely renderer-side and transfers unchanged. The 2-stage workflow is just two `chat()` calls in sequence — same as odyssey, larger payload.

### Important: testing cadence

Run `npm test` after each port. Open `npm run electron:dev` and click through to verify the page loads after each port. After every 5 ports, run `npm run electron:pack` and open the packaged build to catch any breakage that only manifests in production.

---

### Task 20: Phase 3 milestone tag

- [ ] **Step 1: Final full sweep**

```bash
npm test
npm run electron:dev   # process-level only here; visual check below
npm run electron:pack
```

- [ ] **Step 2: Visual verification (human)**

Open the packaged `.app`. Click through every card from Home. Each should load its page (no NotMigrated fallback for any of the 18 cards).

- [ ] **Step 3: Tag**

```bash
git tag phase-3-pages-complete
```

---

## Self-Review

**Spec coverage:**
- Setup service for LLM calls → Task 1 ✓
- File-upload service → Task 1 ✓
- Per-page template → applies to Tasks 2–19 ✓
- All 18 pages have an explicit slot → checklist ✓
- Special cases for streaming chat + 2-stage careers → noted ✓
- Milestone tag → Task 20 ✓

**Placeholder scan:** the per-page tasks are templated rather than each fully written out. That's intentional given the work is mechanical and identical across pages — repeating 18 versions would be noise and would lie about how much divergence there really is. The template plus the "Special-case notes" section covers the real variation.

**Type consistency:**
- `chat()` signature in llm.ts matches the type used by every per-page port (no per-page reinvention).
- `extractTextFromFile()` returns `{text, filename}` consistently.
- `ChatMessage` role enum covers `system | user | assistant` — Anthropic's separate `system` field is handled inside `buildProviderRequest`.

**Risk notes for the executor:**

- **Provider response shape drift.** Test llm.ts against fixture responses (mocked) before relying on it across 16 pages. A bug in `parseProviderResponse` would surface inconsistently across pages and waste hours.
- **Settings keys.** The existing app uses different secureStorage key names for each provider (`openai-api-key`, etc.). Verify by reading `app/settings/page.tsx`'s save logic before assuming naming.
- **`useRouter` → `useNavigate` is the most common porting bug.** Page that has `router.push('/foo')` becomes `navigate('/foo')`. Catch and rewrite all of these per page.
- **Zustand stores transfer unchanged.** `lib/session-store.ts` etc. are renderer-side, framework-agnostic. Don't refactor while porting.
- **`next/image` doesn't exist.** Any `<Image>` becomes `<img>`. Easy.
- **`next/link` becomes react-router-dom `Link`.** Easy.

**Rollback:** If Phase 3 derails, individual page ports can be reverted commit-by-commit. To roll back entire phase: `git reset --hard phase-2-ipc-complete`.

---

## What comes after Phase 3

Phase 4: delete `app/`, `electron/`, `next.config.mjs`, `lib/utils.ts`, legacy `lib/file-processors.ts`, `lib/llm-providers.ts`; prune `next` + `pdf-parse` deps; clean `public/` of Next.js leftovers; drop `extraResources` block; drop `next-env.d.ts`.

Phase 5: CI workflow refresh (talk-buddy pattern), Mac notarisation (`scripts/notarize.js` + `NOTARIZE_APPLE_*` secrets), first real release.
