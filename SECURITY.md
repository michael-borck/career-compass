# Security

Career Compass is a privacy-first desktop app. This document describes the
security model, what protections are in place, and how releases are signed.

## Reporting a vulnerability

Open a [GitHub issue](https://github.com/michael-borck/career-compass/issues)
or email the maintainer (see `package.json` author). There is no bug bounty;
reports are handled on a best-effort basis.

## Privacy model

- All file processing happens on-device. Resume files never leave the machine
  except as extracted text inside the LLM API calls **you configure**.
- The default provider is Ollama (fully local — nothing leaves the device).
- No analytics, no tracking, no external requests at startup (fonts are
  bundled; the only network calls are to your chosen LLM/search providers
  and the GitHub releases endpoint for auto-update).
- Session data (resume text, results, chat history) persists in the Electron
  profile on-device via localStorage so it survives restarts. "Start over"
  clears it.

## Renderer hardening

- `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`.
- The preload bridge (`src/main/preload.js`) exposes a fixed, named API —
  the renderer cannot invoke arbitrary IPC channels.
- Production builds carry a strict Content-Security-Policy
  (`default-src 'self'`, no external origins) injected at build time
  (`vite.config.ts`).
- Window creation is denied everywhere; safe external URLs
  (http/https/mailto only) open in the system browser
  (`src/main/services/external-urls.js`).
- LLM output is rendered as text by React — no `dangerouslySetInnerHTML`.

## Main-process IPC surface

All handlers live in `src/main/index.js` (type-checked via `@ts-check`):

- `api:fetch` — outbound HTTP proxy. Rejects non-http(s) URLs, caps response
  bodies at 10 MB, follows at most 5 redirects
  (`src/main/services/api-fetch.js`).
- `get-env-var` — allowlisted to the API-key variables declared in
  `src/shared/providers.js`; arbitrary environment reads are refused.
- `files:parsePdf` / `files:parseDocx` — enforce a 20 MB cap
  (`src/shared/limits.js`) on both sides of the bridge before the parsing
  libraries see any bytes.

## API key storage

- Keys are encrypted with Electron `safeStorage`: Keychain on macOS,
  DPAPI on Windows, Secret Service (GNOME Keyring / KWallet) on Linux.
- On Linux **without** a keyring service, Chromium falls back to the
  `basic_text` backend (a hardcoded key — obfuscation, not encryption).
  The app detects this via `getSelectedStorageBackend()` and Settings shows
  a key-storage warning instead of silently degrading. The `.deb` package
  depends on `libsecret-1-0` so apt installs the Secret Service client.
- Store contents and key values are never logged.

## Releases and code signing

- Releases are tag-triggered (`v*`) in `.github/workflows/release.yml`.
  The workflow re-runs typecheck + tests on every platform before building,
  so a hand-pushed tag cannot ship untested code.
- **macOS**: signed with a Developer ID certificate (`CSC_LINK` /
  `CSC_KEY_PASSWORD` secrets) and notarized via the `afterSign` hook
  (`scripts/notarize.js`, `NOTARIZE_APPLE_*` secrets — app-specific
  password, not the account password).
- **Windows**: NSIS installer, currently unsigned.
- **Linux**: AppImage + `.deb`, built in separate electron-builder
  invocations (a combined run races on the AppImage runtime download).
- Auto-update uses `electron-updater` against GitHub releases. The publish
  job only promotes the draft release after **all** platform builds succeed,
  so an update can never be missing a platform.
- Secrets live exclusively in GitHub Actions; nothing is committed.

## Dependency hygiene

- `npm audit` is part of routine maintenance (last full pass: June 2026,
  including the Electron major upgrade).
- CI gates every push on typecheck, ESLint, Prettier, and the vitest suite;
  Playwright e2e runs against the real Electron runtime locally.
