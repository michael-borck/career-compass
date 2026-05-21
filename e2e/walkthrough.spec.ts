import { test, expect, type Page } from '@playwright/test';
import { launchCareerCompass } from './helpers';

// Each card on the landing page maps to a route. Visiting each one and
// confirming the renderer doesn't crash is the cheapest valuable smoke
// test we can run against the packaged app.
const ROUTES = [
  '/careers',
  '/compare',
  '/industry',
  '/chat',
  '/gap-analysis',
  '/learning-path',
  '/skills-mapping',
  '/interview',
  '/odyssey',
  '/board',
  '/values',
  '/career-story',
  '/pitch',
  '/cover-letter',
  '/resume-review',
  '/portfolio',
  '/settings',
  '/about',
];

test('landing renders the hero, footer, and all 16 action cards', async () => {
  const { app, window } = await launchCareerCompass();
  try {
    await expect(window.locator('h1', { hasText: 'Your Career' })).toBeVisible();
    await expect(window.locator('footer', { hasText: 'Buddy suite' })).toBeVisible();
    await expect(window.locator('header').getByText('Career Compass')).toBeVisible();

    const actionCards = window.locator('button[title]').filter({
      has: window.locator('h3'),
    });
    await expect(actionCards).toHaveCount(16);
  } finally {
    await app.close();
  }
});

test('every route navigated from hash router renders without crashing', async () => {
  const { app, window } = await launchCareerCompass();
  try {
    for (const route of ROUTES) {
      await navigateTo(window, route);
      // Renderer should still be alive — header is rendered on every route.
      await expect(window.locator('header').getByText('Career Compass')).toBeVisible({
        timeout: 5000,
      });
      // No unhandled error overlay (React error boundary or vite runtime).
      await expect(window.locator('text=Application error')).toHaveCount(0);
    }
  } finally {
    await app.close();
  }
});

test('header nav and back button navigate between known routes', async () => {
  const { app, window } = await launchCareerCompass();
  try {
    await window.getByRole('link', { name: 'Settings' }).first().click();
    await window.waitForURL(/#\/settings$/, { timeout: 5000 });

    await window.getByRole('link', { name: 'Home' }).first().click();
    await window.waitForURL(/#\/$/, { timeout: 5000 });

    // Hero is back, so navigation is functional both ways.
    await expect(window.locator('h1', { hasText: 'Your Career' })).toBeVisible();
  } finally {
    await app.close();
  }
});

async function navigateTo(window: Page, route: string): Promise<void> {
  // HashRouter — change the fragment directly instead of clicking through
  // the UI, so we don't depend on a specific path to reach each route.
  await window.evaluate((target) => {
    window.location.hash = `#${target}`;
  }, route);
}
