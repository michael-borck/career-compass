# Phase 2 — IPC Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give `src/main/` everything Phase 3 needs to port pages without rewriting renderer logic: a CORS-bypassing HTTP fetch proxy, PDF/DOCX parsing handlers, and full TypeScript types for `window.electronAPI`. After Phase 2, no renderer code calls these yet — the infrastructure just exists and is verifiable.

**Architecture:** Talk-buddy pattern. Main process owns the network and node-only file libs; renderer makes typed IPC calls. Single generic `api:fetch` handler (Electron `net` module) carries all outbound HTTP. Dedicated `files:parsePdf` and `files:parseDocx` handlers wrap `pdf-parse` and `mammoth`. Existing IPC bridges (`store`, `secureStorage`, `models`) stay untouched — they already work.

**Tech Stack:** Electron 37 `net` module, `pdf-parse` ^1.1.1 (already in deps), `mammoth` ^1.9.1 (already in deps), vitest 4 (already in deps).

**Out of scope for Phase 2:** porting any `/api/*` route's prompt/orchestration logic. Phase 3 does that per-page. Phase 2 only adds the lower-level plumbing.

**Acceptance criteria:**
- `npm run electron:dev` opens window. DevTools console can run:
  - `await window.electronAPI.apiFetch('https://api.github.com/zen', { method: 'GET' })` → returns `{ ok: true, status: 200, body: '<a koan>' }`.
  - `await window.electronAPI.parsePdf(<Uint8Array of a PDF>)` → returns extracted text as a string.
  - `await window.electronAPI.parseDocx(<Uint8Array of a docx>)` → returns extracted text.
- `npm test` passes a new test suite at `src/main/services/file-processors.test.js` covering both parsers.
- `src/renderer/types/electron.d.ts` declares `window.electronAPI` with full types for both existing and new methods. A renderer .tsx file compiling against it does not require any `(window as any)` casts.
- All 376+ existing tests still pass.

---

### Task 1: `api:fetch` IPC handler + electron.d.ts

**Files:**
- Create: `src/main/services/api-fetch.js`
- Modify: `src/main/index.js` (add ipcMain handler)
- Modify: `src/main/preload.js` (expose on `window.electronAPI`)
- Create: `src/renderer/types/electron.d.ts`

**Step 1: Create `src/main/services/api-fetch.js`**

```javascript
// Renderer-callable HTTP fetch via Electron's net module. Bypasses CORS
// and preflight because main process is Node, not a browser origin.
// Returns the response body as a UTF-8 string (sufficient for JSON APIs);
// extend with binary support only when a caller needs it.

const { net } = require('electron');

function apiFetch({ url, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = net.request({ method, url });
    } catch (err) {
      reject(new Error(`Invalid request: ${err.message}`));
      return;
    }

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value);
    }

    const chunks = [];
    request.on('response', (response) => {
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: response.headers,
          body: buf.toString('utf-8'),
        });
      });
      response.on('error', (err) => reject(err));
    });

    request.on('error', (err) => reject(err));
    request.on('abort', () => reject(new Error('Request aborted')));

    if (body !== undefined && body !== null) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

module.exports = { apiFetch };
```

- [ ] **Step 2: Wire IPC handler in `src/main/index.js`**

Find the existing IPC handler block (search for `ipcMain.handle('store-get'`). Add this handler near the others, in a coherent location (e.g., right after the model-listing handlers).

```javascript
// Generic outbound HTTP. Renderer uses this for LLM completion calls and any
// external HTTP that would otherwise hit CORS. Args: { url, method, headers, body }.
const { apiFetch } = require('./services/api-fetch');
ipcMain.handle('api:fetch', async (_event, args) => apiFetch(args));
```

The `require` should be at the TOP of the file with the other requires, not inline — move it to wherever the existing `const { app, BrowserWindow, ... } = require('electron')` line is. Group with other local requires.

- [ ] **Step 3: Expose on `window.electronAPI` in `src/main/preload.js`**

Find the existing `contextBridge.exposeInMainWorld('electronAPI', { ... })` block. Add a top-level `apiFetch` method:

```javascript
apiFetch: (args) => ipcRenderer.invoke('api:fetch', args),
```

It goes at the same level as `store`, `secureStorage`, `models` — not nested inside any of them.

- [ ] **Step 4: Create `src/renderer/types/electron.d.ts`**

Full typing for everything the preload currently exposes, plus `apiFetch`. Use this exact content:

```typescript
// Global types for window.electronAPI exposed by src/main/preload.js.
// All existing IPC bridges plus the new Phase 2 additions.

export type ApiFetchArgs = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown> | unknown[];
};

export type ApiFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  body: string;
};

declare global {
  interface Window {
    electronAPI: {
      // Settings store (electron-store with safeStorage encryption)
      store: {
        get: <T = unknown>(key: string, defaultValue?: T) => Promise<T>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
        clear: () => Promise<void>;
      };

      // OS-encrypted secure storage for API keys
      secureStorage: {
        setPassword: (service: string, password: string) => Promise<void>;
        getPassword: (service: string) => Promise<string | null>;
        deletePassword: (service: string) => Promise<void>;
      };

      // Provider model listing and connection tests
      models: {
        getOllamaModels: (baseURL: string) => Promise<string[]>;
        getProviderModels: (
          provider: string,
          config: { apiKey?: string; baseURL?: string }
        ) => Promise<string[]>;
        testConnection: (
          provider: string,
          config: { apiKey?: string; baseURL?: string; model?: string }
        ) => Promise<{ success: boolean; error?: string }>;
      };

      // App info
      getVersion: () => Promise<string>;
      getPlatform: () => string;
      getEnvVar: (name: string) => Promise<string | null>;

      // Phase 2 additions
      apiFetch: (args: ApiFetchArgs) => Promise<ApiFetchResponse>;
    };
  }
}

export {};
```

The `declare global` + `export {}` shape is required so this file is treated as a module that augments the global scope. Don't drop `export {}` — without it TS treats the file as a script and the declaration leaks differently.

- [ ] **Step 5: Update `tsconfig.json` if needed**

The default Next.js `tsconfig.json` `include` glob is likely `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`. As long as `src/renderer/types/electron.d.ts` falls under `**/*.ts`, it'll be picked up.

Verify:

```bash
node -e "console.log(require('./tsconfig.json').include)"
```

If `src/renderer/types/electron.d.ts` isn't covered, add `src/renderer/**/*` to the include array. Otherwise no edit.

- [ ] **Step 6: Process-level smoke test**

Run `npm run electron:dev` in background. Read stdout. Confirm:
- Vite logs `Local: http://localhost:5180/`
- Electron starts (`electron-store loaded successfully`)
- NO new error messages about missing modules, undefined ipcRenderer, etc.

KillShell after a few seconds.

The actual `apiFetch` smoke test requires a human at DevTools — they'll run `await window.electronAPI.apiFetch(...)` and confirm a real response comes back. Don't block on that here; report it as deferred.

- [ ] **Step 7: Commit**

```bash
git add src/main/services/ src/main/index.js src/main/preload.js src/renderer/types/
git commit -m "feat(ipc): add api:fetch handler and window.electronAPI types"
```

---

### Task 2: File parsing IPC handlers

**Files:**
- Create: `src/main/services/file-processors.js`
- Create: `src/main/services/file-processors.test.js`
- Modify: `src/main/index.js` (two ipcMain handlers)
- Modify: `src/main/preload.js` (expose two methods)
- Modify: `src/renderer/types/electron.d.ts` (add types)
- Create (test fixture): `src/main/services/__fixtures__/sample.pdf`
- Create (test fixture): `src/main/services/__fixtures__/sample.docx`

- [ ] **Step 1: Create `src/main/services/file-processors.js`**

Pure functions that take a Node Buffer and return a Promise<string>. No IPC concerns, fully testable.

```javascript
// File parsing — Node-only because pdf-parse and mammoth both depend on
// libs that don't exist in browser environments. Lives in main process,
// called from renderer via IPC.

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parsePdf requires a Node Buffer');
  }
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('parseDocx requires a Node Buffer');
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

module.exports = { parsePdf, parseDocx };
```

- [ ] **Step 2: Add test fixtures**

Locate small PDF and DOCX sample files (~1-2KB each) for the test suite. Options in priority order:

1. **Generate fresh**: write tiny test files with known content. For PDF:
   ```bash
   node -e "
   const fs = require('fs');
   const { PDFDocument } = require('pdf-lib');
   // ...
   " > /dev/null 2>&1 || echo "pdf-lib not available"
   ```
   Skip this if it adds a new dep — pdf-lib isn't in package.json. Instead, use option 2.

2. **Use pdf-parse's own test fixture**: `pdf-parse` ships with a sample PDF in `node_modules/pdf-parse/test/data/`. Copy one to use as a fixture.
   ```bash
   ls node_modules/pdf-parse/test/data/ 2>/dev/null | head -5
   ```
   Copy a small one (~5KB or less) to `src/main/services/__fixtures__/sample.pdf`.

3. **For DOCX, use mammoth's**: `node_modules/mammoth/test-data/` or similar.
   ```bash
   find node_modules/mammoth -name "*.docx" 2>/dev/null | head -5
   ```
   Copy one to `src/main/services/__fixtures__/sample.docx`.

If neither library ships fixtures, write a minimal DOCX manually using `mammoth.extractRawText` won't work here (we need the file format, not the API). In that case: skip the integration tests, write only a TypeError-on-bad-input test. Note this in the commit message.

- [ ] **Step 3: Create `src/main/services/file-processors.test.js`**

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parsePdf, parseDocx } from './file-processors.js';

const FIXTURES = resolve(__dirname, '__fixtures__');

describe('parsePdf', () => {
  it('rejects non-Buffer input', async () => {
    await expect(parsePdf('not a buffer')).rejects.toThrow(TypeError);
    await expect(parsePdf(new Uint8Array([1, 2, 3]))).rejects.toThrow(TypeError);
  });

  it('extracts text from a real PDF', async () => {
    const buf = readFileSync(resolve(FIXTURES, 'sample.pdf'));
    const text = await parsePdf(buf);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });
});

describe('parseDocx', () => {
  it('rejects non-Buffer input', async () => {
    await expect(parseDocx('not a buffer')).rejects.toThrow(TypeError);
  });

  it('extracts text from a real DOCX', async () => {
    const buf = readFileSync(resolve(FIXTURES, 'sample.docx'));
    const text = await parseDocx(buf);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });
});
```

If a fixture wasn't available (per Step 2), drop the corresponding integration test and keep only the TypeError test.

- [ ] **Step 4: Add IPC handlers in `src/main/index.js`**

Below the `api:fetch` handler from Task 1, add:

```javascript
const { parsePdf, parseDocx } = require('./services/file-processors');

ipcMain.handle('files:parsePdf', async (_event, fileBytes) => {
  // Renderer can't easily ship a Node Buffer; it sends a Uint8Array, which
  // structured-clones across the IPC boundary. Convert to Buffer here.
  const buf = Buffer.from(fileBytes);
  return parsePdf(buf);
});

ipcMain.handle('files:parseDocx', async (_event, fileBytes) => {
  const buf = Buffer.from(fileBytes);
  return parseDocx(buf);
});
```

The `require` for file-processors goes at the top of the file with other local requires, not inline.

- [ ] **Step 5: Expose on preload (`src/main/preload.js`)**

Add to the `electronAPI` object:

```javascript
parsePdf: (fileBytes) => ipcRenderer.invoke('files:parsePdf', fileBytes),
parseDocx: (fileBytes) => ipcRenderer.invoke('files:parseDocx', fileBytes),
```

Top-level, same as `apiFetch`.

- [ ] **Step 6: Update `electron.d.ts`**

Add to the `electronAPI` interface inside `declare global`:

```typescript
// Phase 2 — file parsing in main process (pdf-parse, mammoth are node-only)
parsePdf: (fileBytes: Uint8Array) => Promise<string>;
parseDocx: (fileBytes: Uint8Array) => Promise<string>;
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: existing 376 tests still pass + the new file-processors tests added on top. If fixtures were available, expect 4 new tests. If fixtures were skipped, expect 2 new tests.

If tests fail because vitest can't find `pdf-parse` or `mammoth`: those are existing deps that worked before; report BLOCKED with the error rather than guessing.

- [ ] **Step 8: Process-level Electron smoke**

`npm run electron:dev` in background. Confirm Vite + Electron start cleanly (no new errors). KillShell.

- [ ] **Step 9: Commit**

```bash
git add src/main/services/ src/main/index.js src/main/preload.js src/renderer/types/
git commit -m "feat(ipc): add file-processors handlers (parsePdf, parseDocx)"
```

---

### Task 3: Phase 2 milestone tag

- [ ] **Step 1: Full test sweep**

```bash
npm test
```

Expected: 376 + 2 to 4 new tests, all green.

- [ ] **Step 2: Final electron:dev smoke (process-level)**

Run `npm run electron:dev` in background, confirm clean Vite + Electron startup, kill.

- [ ] **Step 3: Tag**

```bash
git tag phase-2-ipc-complete
```

No push.

---

## Self-Review

**Spec coverage:**
- `api:fetch` IPC handler → Task 1 Steps 1–3 ✓
- `window.electronAPI` typed → Task 1 Step 4 ✓
- `parsePdf` IPC → Task 2 Steps 4–5 ✓
- `parseDocx` IPC → Task 2 Steps 4–5 ✓
- Tests for parsers → Task 2 Step 3 ✓
- All existing tests still pass → Task 3 Step 1 ✓

**Placeholder scan:** None. The "skip integration test if fixture unavailable" fallback in Task 2 Step 3 is a real conditional, not a placeholder.

**Type consistency:**
- `ApiFetchArgs` shape used identically in `api-fetch.js` (destructured args) and `electron.d.ts` (exported type).
- `ApiFetchResponse` returned by main matches the type declared in renderer.
- `parsePdf` / `parseDocx` signatures: main accepts `Uint8Array` (via structured clone), converts to `Buffer` internally; renderer types declare `Uint8Array` input → `string` output. Match.

**Risk notes for the executor:**

- **pdf-parse test-file bug.** `pdf-parse` has historically had a bug where its index.js tries to read its own test PDF at import time (`./test/data/05-versions-space.pdf`) if `module.parent` is undefined. In our case it'll work because we `require` it from a regular module, but if the import fails with "ENOENT: ./test/data/...", the workaround is `const pdfParse = require('pdf-parse/lib/pdf-parse.js')` (skip the index entry).
- **Mammoth needs node:zlib.** Should be fine in main process. If somehow not, mammoth will throw a clear error at import time.
- **`api:fetch` doesn't support streaming.** Phase 3 may want streaming for chat (OpenAI's `stream: true`). If a renderer page needs streaming responses, this handler will need extension. Out of scope here.

**Rollback:** All changes are additive — new files under `src/main/services/`, `src/renderer/types/`, and ipcMain.handle additions in two existing files. To roll back Phase 2 cleanly:

```bash
git reset --hard phase-1-scaffold-complete
```

This restores the Phase 1 milestone and undoes everything after.
