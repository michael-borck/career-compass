# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Career Compass is a privacy-first career exploration desktop application built as a Vite + React + Electron app. It analyzes resumes locally using multiple LLM providers to suggest personalized career paths. The architecture prioritizes user privacy with local file processing and secure storage.

Originally built on Next.js 14 (App Router + static export, wrapped in Electron). Phases 1–4 of the migration moved the renderer to Vite + React Router and the API routes into Electron IPC handlers. Talk-buddy parity.

## Common Commands

### Development
```bash
npm run dev                    # Start Vite dev server only (renderer at :5180)
npm run electron:dev           # Start Vite + Electron together (main dev command)
```

### Building
```bash
npm run build                  # Vite production build → dist/
npm run electron:pack          # Package for testing (no installer)
npm run electron:dist          # Build production distributables for current platform
```

### Testing
```bash
npm test                       # Run vitest suite (renderer services + main IPC handlers)
npm run test:watch             # vitest in watch mode
```

### Release Process
```bash
# Update version in package.json, commit, then:
git tag v0.x.x
git push origin v0.x.x        # Triggers GitHub Actions multi-platform build
```

## Architecture Overview

### Vite Renderer + Electron Main
- **Vite 8** builds the React renderer with `react-router-dom` v6 in hash router mode (Electron-friendly)
- **Electron main** (`src/main/index.js`) owns the window, IPC handlers, file dialogs, and secure storage
- **No web fallback** — this is a desktop app. Renderer always assumes `window.electronAPI` is present.

### Multi-Provider LLM Architecture
Located in `src/renderer/services/llm.ts`, implements a provider abstraction pattern:
- **Common `chat()` entry point** that builds provider-specific request bodies
- **Network call goes over IPC** (`api:fetch` handler in main) — the renderer never makes direct cross-origin HTTP from Chromium
- **Environment variable fallback** when no stored API keys
- **Connection testing** with provider-specific health check endpoints

Supported providers:
- **Ollama** (local, privacy-first default)
- **OpenAI** (GPT models)
- **Anthropic Claude**
- **Groq** (fast inference)
- **Google Gemini**
- **OpenRouter**
- **Custom OpenAI-compatible**

### Settings and Storage Architecture
Settings live in `lib/settings-store.ts` (still in the legacy tree — will move to `src/renderer/services/` in a later cleanup pass).

- **Settings**: `electron-store` in user data directory
- **API Keys**: `safeStorage` with OS-native encryption (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- **All store methods are async** — they cross the IPC bridge. Always `await` `settingsStore.get()`/`set()`.

### File Processing Pipeline
- **Renderer side** (`src/renderer/services/file-upload.ts` + `text.ts`): validates type/size, reads as ArrayBuffer for binary files (PDF/DOCX), passes through for text
- **Main side** (`src/main/services/file-processors.js`): uses `pdf-parse` and `mammoth` to extract text — Node-only deps that can't run in the renderer
- **IPC**: `files:parsePdf` and `files:parseDocx` handlers

### Security Architecture

**Electron Security Hardening** (`src/main/index.js`):
- `contextIsolation: true` with secure IPC bridge (`src/main/preload.js`)
- `nodeIntegration: false` and `webSecurity: true`
- `titleBarStyle: 'hiddenInset'` on macOS — requires `.drag-region` element in the renderer (see `src/renderer/components/Header.tsx`)
- External URLs opened in system browser, not within the app
- Secure API key storage via OS-native encryption

**Privacy Design**:
- All file processing happens locally; files never leave the device except as text in LLM API calls
- No analytics or tracking
- User data stays on device

### IPC Communication Pattern
Main ↔ renderer via `src/main/preload.js`:
```javascript
// Generic outbound HTTP (avoids renderer CORS, lets us add timeouts/headers)
window.electronAPI.apiFetch(url, options)

// Settings + secure storage
window.electronAPI.store.get(key, defaultValue)
window.electronAPI.store.set(key, value)
window.electronAPI.secureStorage.setPassword(service, password)
window.electronAPI.secureStorage.getPassword(service)

// Provider model management
window.electronAPI.models.getOllamaModels(baseURL)
window.electronAPI.models.testConnection(provider, config)

// File parsing (PDF/DOCX → text)
window.electronAPI.files.parsePdf(arrayBuffer)
window.electronAPI.files.parseDocx(arrayBuffer)
```

### Career Generation Workflow
Two-stage LLM process in `src/renderer/services/careers.ts`:
1. **Initial Analysis**: Resume + context → 6 career suggestions with basic info
2. **Detailed Analysis**: Each career → comprehensive roadmap, skills analysis, timeline

**ReactFlow Integration**: Career suggestions rendered as interactive nodes in `components/CareerNode.tsx` with visualization in `src/renderer/pages/Careers.tsx`.

## Build Configuration

### Vite (`vite.config.ts`)
- `base: './'` so Electron can load `dist/index.html` over `file://`
- React plugin only; no SSR
- Aliases:
  - `next/link` and `next/navigation` → renderer-side shims (`src/renderer/shims/*`) — kept until the rest of the legacy `components/` tree is moved into `src/renderer/`
  - `@/components/*` → `components/*` (legacy tree, still imported by ported pages)
  - `@/lib/*` → `lib/*` (legacy tree)
  - `@` → `src/renderer` (everything new lives under here)

### Electron Builder (`package.json` build section)
- **Cross-platform targets**: Windows (NSIS), macOS (DMG), Linux (AppImage)
- **Artifact naming**: `Career-Compass-{version}-{arch}.{ext}` (no spaces)
- **Auto-updater**: GitHub releases integration via `electron-updater`
- **Code signing**: Placeholder configuration; macOS notarisation hasn't been wired up yet (Phase 5)

### GitHub Actions (`.github/workflows/release.yml`)
- **Matrix build**: Parallel builds on macOS, Windows, Ubuntu
- **Tag-triggered**: Activates on `v*` tags (e.g., `v0.4.0`)
- **Automated releases**: Creates GitHub release with platform-specific binaries

## Development Guidelines

### Environment Variable Support
Settings system supports environment variables as fallback:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `GOOGLE_API_KEY`
- Accessed via `window.electronAPI.getEnvVar()` in the renderer
- Check `lib/settings-store.ts` for precedence order

### Error Handling Patterns
- **`LLMError`** in `src/renderer/services/llm.ts` wraps parse + network failures with structured `code` strings
- **Toast notifications** using `react-hot-toast` for user feedback
- **`isTokenLimitError()`** (`lib/token-limit.ts`) recognises provider-specific token-budget errors so pages can suggest trimming context

### File Structure Conventions
- `/src/renderer/*` — Vite-built React app (pages, components, services, shims)
  - `pages/` — route components (one per `/<path>` in `App.tsx`)
  - `services/` — business logic (llm, file-upload, board, careers, …) with co-located `.test.ts`
  - `components/` — shared UI (Header, Footer, Hero, ActionCards, SessionBanner)
  - `shims/` — Next.js compatibility shims for legacy imports (`next/link`, `next/navigation`)
- `/src/main/*` — Electron main process (`index.js`, `preload.js`, `services/`)
- `/lib/*` — legacy business logic still consumed by renderer (`session-store`, `settings-store`, `prompts/`, `markdown-export`, …). Slated to move under `src/renderer/` in a future cleanup pass.
- `/components/*` — legacy UI components still consumed by renderer (UI primitives in `ui/`, per-feature `ResultView` and `-docx` files). Same migration trajectory as `lib/`.
- `/assets/*` — icons for electron-builder

### Testing Connection to LLM Providers
Connection testing implementation varies by provider, all routed through `api:fetch` IPC:
- **Ollama**: `GET /api/tags`
- **OpenAI / Groq / OpenRouter / custom**: `GET /v1/models`
- **Claude**: `POST /v1/messages` with a minimal test request
- **Gemini**: `GET /v1beta/models`

All connection tests include API key validation and environment variable fallback logic.
