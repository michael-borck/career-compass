import { defineConfig } from '@playwright/test';

// Electron tests launch the packaged .app via _electron.launch — we don't
// need browser projects, web servers, or HTTP base URLs.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,         // one Electron instance at a time
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,              // launching Electron + first paint can be slow
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
