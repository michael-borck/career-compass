# Phase 1 — Vite Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Vite + React + Electron scaffold using the industry-standard `src/main/` + `src/renderer/` layout. After Phase 1, `npm run electron:dev` opens an Electron window rendering a Vite-served placeholder page, and the existing IPC bridges (`store`, `secureStorage`, `models`) continue to work unchanged.

**Architecture:** Replace Next.js dev/build pipeline with Vite. Move Electron main process from `electron/` to `src/main/`. Build a fresh React renderer at `src/renderer/` with react-router (HashRouter for `file://` safety). Leave `app/`, `electron/`, `next.config.mjs` on disk untouched — Phases 2–4 will absorb their contents, Phase 4 deletes the originals. After Phase 1 the AI features will not work in `electron:dev` because no pages have been ported yet; that is expected.

**Tech Stack:** Vite 5, React 18, react-router-dom 6 (HashRouter), Tailwind 3 (existing config covers `./src/**` already), vitest 4 (existing), Electron 37 (existing), TypeScript 5 (existing).

**Out of scope for Phase 1:** porting any page from `app/`, moving `lib/` or `components/`, adding LLM/file-processing IPC handlers, CI changes, notarisation. Those land in Phases 2–5.

**Acceptance criteria (verify before tagging Task 7):**
- `npm run dev` starts Vite on port 5180.
- `npm run electron:dev` opens an Electron window showing the placeholder Home page styled with the existing Tailwind tokens (paper background, ink text).
- Clicking any link in the route grid navigates to a `NotMigrated` page via HashRouter (`/#/careers` etc.).
- DevTools console: `await window.electronAPI.store.get('settings', null)` returns the same settings the old Next.js build had stored.
- `npm test` (vitest) still passes `lib/url-classify.test.ts`.
- `npm run electron:pack` produces a `.app` (or platform equivalent) under `release/` that opens and renders the placeholder Home page from `file://`.

---

### Task 1: Install Vite + react-router; replace Next.js script entries

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install build-time deps**

```bash
npm install --save-dev vite @vitejs/plugin-react autoprefixer
```

Expected: lockfile updates, no peer-dep errors. `vite` and `@vitejs/plugin-react` appear under `devDependencies`. `autoprefixer` is needed by Tailwind's PostCSS pipeline once Next.js stops providing it transitively.

- [ ] **Step 2: Install runtime dep**

```bash
npm install --save react-router-dom@^6
```

Pin to v6 to match talk-buddy (`react-router-dom@^6.8.0`). v7 is a major version with API reorganisation; v6 is the stable target.

- [ ] **Step 3: Replace `scripts` block in `package.json`**

Find and remove these lines:

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "next lint",
"electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && cross-env NODE_ENV=development electron . --no-sandbox\"",
"electron:dev-unsafe": "concurrently \"npm run dev\" \"wait-on http://localhost:3000 && cross-env NODE_ENV=development electron . --no-sandbox --disable-web-security\"",
"electron:pack": "next build && electron-builder --dir",
"electron:dist": "next build && electron-builder --publish never",
```

Replace with:

```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview",
"electron:dev": "concurrently -k \"npm run dev\" \"wait-on tcp:5180 && cross-env NODE_ENV=development electron . --no-sandbox\"",
"electron:pack": "npm run build && electron-builder --dir",
"electron:dist": "npm run build && electron-builder --publish never",
```

`-k` makes concurrently kill all children when one exits — Ctrl-C cleanly tears down both Vite and Electron.

- [ ] **Step 4: Update `main` field**

In `package.json`, change:

```json
"main": "electron/main.js",
```

to:

```json
"main": "src/main/index.js",
```

The target file doesn't exist yet — Task 4 creates it. Updating `main` now keeps the diff coherent.

- [ ] **Step 5: Verify dep install**

```bash
ls node_modules/vite/package.json node_modules/@vitejs/plugin-react/package.json node_modules/react-router-dom/package.json node_modules/autoprefixer/package.json
```

Expected: all four paths exist (exit 0).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vite + react-router deps, swap scripts to vite shape"
```

---

### Task 2: Vite config + entry HTML

**Files:**
- Create: `vite.config.ts`
- Create: `index.html` (at repo root)
- Create: `postcss.config.cjs` (if needed — see Step 4)

- [ ] **Step 1: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});
```

`base: './'` is critical. It tells Vite to emit relative asset paths in the built `index.html` — required for the packaged Electron app to load assets from `file://`.

- [ ] **Step 2: Create `index.html` at repo root**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Career Compass</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Smoke check Vite starts**

```bash
npm run dev
```

Expected output includes:

```
  VITE v5.x.x  ready in NNN ms

  ➜  Local:   http://localhost:5180/
```

Open http://localhost:5180 in a browser. Expected: blank page (no React mount yet). DevTools console will show a 404 for `/src/renderer/main.tsx` — fine, Task 3 creates it.

Hit Ctrl-C.

- [ ] **Step 4: PostCSS check**

The existing `postcss.config.mjs` uses ESM. Vite handles ESM PostCSS configs natively, so this should just work. But if Step 3 of Task 3 (below) produces an unstyled page, check whether `autoprefixer` needs to be added explicitly:

```javascript
// postcss.config.mjs — only edit if Task 3 page is unstyled
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

Do not edit speculatively — defer until Task 3 reveals a problem.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts index.html
git commit -m "feat(vite): add vite config and entry html"
```

---

### Task 3: Renderer skeleton with react-router

**Files:**
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/index.css`
- Create: `src/renderer/pages/Home.tsx`
- Create: `src/renderer/pages/NotMigrated.tsx`

- [ ] **Step 1: Create the directory and copy globals.css**

```bash
mkdir -p src/renderer/pages
cp app/globals.css src/renderer/index.css
```

The 214-line `app/globals.css` contains Tailwind directives + the existing CSS variable design tokens (paper, ink, accent, etc.). It transfers verbatim — Tailwind doesn't care which framework imports it.

- [ ] **Step 2: Create `src/renderer/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
```

Use `HashRouter`, not `BrowserRouter`. In packaged Electron the renderer loads via `file://` and the History API path-based routing breaks. HashRouter (`/#/route`) sidesteps the issue and matches talk-buddy's pattern.

- [ ] **Step 3: Create `src/renderer/App.tsx`**

```typescript
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NotMigrated from './pages/NotMigrated';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotMigrated />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Create `src/renderer/pages/Home.tsx`**

```typescript
import { Link } from 'react-router-dom';

const ROUTES_TO_MIGRATE = [
  'careers', 'pitch', 'cover-letter', 'chat', 'career-story',
  'compare', 'gap-analysis', 'interview', 'learning-path',
  'odyssey', 'portfolio', 'resume-review', 'skills-mapping',
  'values', 'industry', 'board', 'settings', 'about',
];

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-paper text-ink">
      <h1 className="text-3xl font-semibold mb-2">Career Compass — Vite scaffold</h1>
      <p className="text-ink-muted mb-6">
        Phase 1 of the Vite migration. The routes below render a placeholder until each page is ported from <code className="bg-paper-warm px-1 rounded">app/</code>.
      </p>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ROUTES_TO_MIGRATE.map((r) => (
          <li key={r}>
            <Link
              to={`/${r}`}
              className="block px-3 py-2 rounded border border-border hover:bg-paper-warm"
            >
              /{r}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Create `src/renderer/pages/NotMigrated.tsx`**

```typescript
import { Link, useLocation } from 'react-router-dom';

export default function NotMigrated() {
  const location = useLocation();
  return (
    <main className="min-h-screen p-8 bg-paper text-ink">
      <h1 className="text-2xl font-semibold mb-2">Not yet migrated</h1>
      <p className="text-ink-muted mb-4">
        Route <code className="bg-paper-warm px-1 rounded">{location.pathname}</code> hasn&apos;t been ported from the Next.js codebase yet.
      </p>
      <Link to="/" className="text-accent underline">
        ← Back to scaffold home
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Smoke check renderer in a browser**

```bash
npm run dev
```

Open http://localhost:5180. Expected:

- Home page renders with the title "Career Compass — Vite scaffold".
- Paper-coloured background, dark ink text (Tailwind tokens applying).
- Route grid renders 18 links arranged in 2–3 columns.
- Clicking any link → URL becomes `http://localhost:5180/#/careers` (etc.) → NotMigrated page renders, showing the pathname.
- Clicking "Back to scaffold home" returns to `/`.

If the page is unstyled (raw HTML appearance, no paper background): see Task 2 Step 4 — add `autoprefixer` to `postcss.config.mjs` and reload.

Hit Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/
git commit -m "feat(renderer): vite + react-router skeleton with route placeholders"
```

---

### Task 4: Move Electron main process to `src/main/`

**Files:**
- Create: `src/main/index.js` (copy of `electron/main.js`)
- Create: `src/main/preload.js` (copy of `electron/preload.js`)
- Modify: `src/main/index.js` — update `loadURL` paths

- [ ] **Step 1: Copy the files**

```bash
mkdir -p src/main
cp electron/main.js src/main/index.js
cp electron/preload.js src/main/preload.js
```

- [ ] **Step 2: Update the dev/prod load URLs in `src/main/index.js`**

Find (around line 87–91):

```javascript
const startUrl = isDev
  ? 'http://localhost:3000'
  : `file://${path.join(__dirname, '../out/index.html')}`;
```

Replace with:

```javascript
const startUrl = isDev
  ? 'http://localhost:5180'
  : `file://${path.join(__dirname, '../../dist/index.html')}`;
```

Path math, since `__dirname` is now `<repo>/src/main`:
- Dev: must match `vite.config.ts` server.port (5180).
- Prod: `../../` walks up from `src/main/` to repo root → `dist/index.html` is Vite's build output.

- [ ] **Step 3: Confirm preload reference still resolves**

In `src/main/index.js`, find:

```javascript
preload: path.join(__dirname, 'preload.js'),
```

`__dirname` is now `<repo>/src/main/`, so this resolves to `<repo>/src/main/preload.js` — which exists (Step 1 copied it there). No edit needed.

- [ ] **Step 4: Verify no stale references**

```bash
grep -n "localhost:3000\|out/index.html\|electron/preload" src/main/index.js
```

Expected: no matches.

- [ ] **Step 5: Full smoke test**

```bash
npm run electron:dev
```

Expected sequence in the terminal:
1. `concurrently` starts both processes.
2. Vite logs `Local: http://localhost:5180/`.
3. `wait-on` completes (port 5180 is up).
4. Electron window opens.

In the Electron window:
- Home page renders identically to the browser version.
- Open DevTools (Cmd-Opt-I on macOS).
- Run in the console: `await window.electronAPI.store.get('settings', null)`.
- Expected: returns the persisted settings object (provider, apiKey, baseURL, model) — proving the IPC bridge through the new main process works and reads from the same electron-store path.

Ctrl-C in the terminal to tear down.

- [ ] **Step 6: Commit**

```bash
git add src/main/
git commit -m "feat(main): move electron main process to src/main/, point at vite"
```

---

### Task 5: Update electron-builder file globs and verify packaged build

**Files:**
- Modify: `package.json` (the `build` block, `files` array)

- [ ] **Step 1: Update electron-builder files glob AND output dir**

In `package.json`, find the `build` block. Two edits.

First, update `build.directories.output` from `"dist"` to `"release"` — the original `"dist"` collides with Vite's `outDir`, which would cause electron-builder's output to land inside Vite's output (and Vite's `emptyOutDir: true` would wipe it on the next build). `"release"` matches the `.gitignore` entry.

Second, update `build.files`:

```json
"files": [
  "out/**/*",
  "electron/**/*",
  "node_modules/**/*",
  "!node_modules/.cache/**/*"
],
```

Replace with:

```json
"files": [
  "dist/**/*",
  "src/main/**/*",
  "node_modules/**/*",
  "!node_modules/.cache/**/*"
],
```

- [ ] **Step 2: Run a packaging dry run**

```bash
npm run electron:pack
```

Expected:
- `npm run build` runs → Vite outputs `dist/index.html` and `dist/assets/*.js`, `dist/assets/*.css`.
- electron-builder writes an unpacked app to `release/mac-arm64/` (macOS), `release/win-unpacked/`, or `release/linux-unpacked/`.
- No errors about missing `out/` or `electron/main.js`.

- [ ] **Step 3: Open the unpacked app**

macOS:
```bash
open release/mac-arm64/Career\ Compass.app
```

(Adjust path for your platform — `release/linux-unpacked/career-compass` or `release/win-unpacked/Career Compass.exe`.)

Expected:
- App launches.
- Window shows the Home page styled with paper/ink Tailwind tokens.
- URL bar (if you enable DevTools and check `window.location`) shows a `file://` URL, not localhost.
- Clicking a route link → URL becomes `file:///.../dist/index.html#/careers` and renders NotMigrated.
- DevTools console: `window.electronAPI.store.get('settings', {})` resolves to the settings object — confirms preload + IPC work in the packaged build.

Quit the app.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "build: update electron-builder files glob for vite layout"
```

---

### Task 6: Confirm vitest still works

**Files:**
- Create (conditionally): `vitest.config.ts`

- [ ] **Step 1: Run the existing tests**

```bash
npm test
```

Expected: `lib/url-classify.test.ts` runs and all assertions pass.

If the test runner fails with `Cannot find module '@/...'`, proceed to Step 2. Otherwise skip to Step 4.

- [ ] **Step 2: Add `vitest.config.ts` (only if Step 1 failed)**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Re-run tests (only if Step 2 ran)**

```bash
npm test
```

Expected: pass.

- [ ] **Step 4: Commit (only if `vitest.config.ts` was created)**

```bash
git add vitest.config.ts
git commit -m "test: explicit vitest alias resolution for src/renderer"
```

---

### Task 7: Phase 1 milestone tag

- [ ] **Step 1: Final electron:dev smoke check**

```bash
npm run electron:dev
```

Walk through:
- Home page renders → click a route link → NotMigrated → "Back to scaffold home" → Home.
- DevTools console: `await window.electronAPI.store.get('settings', {})` returns an object.
- Close the window — both Vite and Electron exit cleanly (because of `concurrently -k`).

- [ ] **Step 2: Final test run**

```bash
npm test
```

Expected: all green.

- [ ] **Step 3: Tag the local milestone**

```bash
git tag phase-1-scaffold-complete
```

Local tag only — do not `git push`. This is a checkpoint marker for the migration, not a release.

---

## Self-Review

**Spec coverage:**

| Requirement | Task(s) |
|---|---|
| Vite scaffolded at root | 1, 2, 3 |
| Industry-standard `src/main/` + `src/renderer/` layout | 3, 4 |
| `npm run electron:dev` opens Vite-powered window | 4 Step 5 |
| `npm run electron:pack` produces a working .app | 5 |
| HashRouter for `file://` safety | 3 Step 2 |
| Settings IPC preserved (no behavior change) | 4 (preload copied unchanged) + 4 Step 5 verification |
| Vitest unaffected | 6 |
| Tailwind tokens preserved | 3 Step 1 (copy globals.css) |
| Existing `app/` and `electron/` left intact for Phases 2–4 | implicit — nothing deletes them |

**Placeholder scan:** No "TODO", "TBD", "handle X", or "similar to" references. Every step has concrete code or commands.

**Type consistency:** No shared types defined in this phase; only React/router library types used.

**Risk notes for the executor:**

- **"Cannot find module 'next'"** during `npm run electron:dev` — should not occur because nothing in `src/renderer/` imports from Next. If it does, grep `src/renderer/` for any accidental `next/*` import.
- **Blank packaged window** — symptom of asset paths broken in `dist/index.html`. Confirm `base: './'` in `vite.config.ts` (Task 2 Step 1) and the `../../dist/index.html` path in `src/main/index.js` (Task 4 Step 2).
- **Unstyled placeholder Home** — Tailwind not applying. Add `autoprefixer` to `postcss.config.mjs` per Task 2 Step 4.
- **`electron-store` initialisation fails after switch** — settings file path is derived from `appId` (`com.michaelborck.career-compass`) which doesn't change. If it does fail, check the app's `userData` path in DevTools: `await window.electronAPI.getVersion()` and look at logs in the terminal.

**Rollback:** All Phase 1 changes are scoped to `package.json`, new files under `src/` and at root, and one `node_modules` install. If Phase 1 derails:

```bash
git reset --hard <commit-before-task-1>
rm -rf src/ dist/ index.html vite.config.ts vitest.config.ts release/
npm install
```

This restores the pre-Phase-1 state. The old Next.js pipeline still works in that state because nothing in `app/` or `electron/` was modified.

---

## Next phase

Once Task 7 is tagged, write `docs/migration/phase-2-ipc.md` — the IPC layer plan. That phase teaches the new `src/main/` how to make LLM calls and process files on behalf of the renderer, replacing what `app/api/*` did during `npm run dev`.
