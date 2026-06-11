import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Launch Electron pointed at the project root (main entry comes from
// package.json "main" — src/main/index.js). This runs the real main
// process + the production Vite build at dist/index.html (set
// NODE_ENV=production so src/main/index.js takes the file:// branch
// instead of localhost:5180). Renderer + IPC code paths are identical
// to the packaged .app; only the asar bundling + code-signing wrapper
// differ. For asar/signing verification, see `npm run electron:pack`.
const PROJECT_ROOT = path.resolve(__dirname, '..');

export async function launchCareerCompass(opts: { userDataDir?: string } = {}): Promise<{
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
}> {
  // Fresh temp profile per launch so tests never touch (or persist into) a
  // real user profile. Pass userDataDir to relaunch against the same profile,
  // e.g. for session-persistence tests.
  const userDataDir =
    opts.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'career-compass-e2e-'));
  const app = await electron.launch({
    args: [PROJECT_ROOT, '--no-sandbox'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CAREER_COMPASS_USER_DATA: userDataDir,
    },
    timeout: 30_000,
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window, userDataDir };
}
