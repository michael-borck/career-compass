import { test, expect, type Page } from '@playwright/test';
import { launchCareerCompass } from './helpers';

// The session store mirrors to localStorage, which lives in the Electron
// profile (userData). Relaunching against the same profile must restore the
// session — the core promise of auto-persistence.

const JOB_TITLE_PLACEHOLDER = 'e.g. Data analyst, UX researcher';

async function navigateTo(window: Page, route: string): Promise<void> {
  await window.evaluate((target) => {
    globalThis.location.hash = `#${target}`;
  }, route);
}

test('session survives an app relaunch', async () => {
  // First launch: type a job title (bound straight to the session store).
  const first = await launchCareerCompass();
  const { userDataDir } = first;
  try {
    await navigateTo(first.window, '/gap-analysis');
    await first.window.getByPlaceholder(JOB_TITLE_PLACEHOLDER).fill('Persistence probe');
    await expect(first.window.getByPlaceholder(JOB_TITLE_PLACEHOLDER)).toHaveValue(
      'Persistence probe'
    );
  } finally {
    await first.app.close();
  }

  // Second launch against the same profile: the session must be restored.
  const second = await launchCareerCompass({ userDataDir });
  try {
    await navigateTo(second.window, '/gap-analysis');
    await expect(second.window.getByPlaceholder(JOB_TITLE_PLACEHOLDER)).toHaveValue(
      'Persistence probe'
    );
    // And the home banner reflects it.
    await navigateTo(second.window, '/');
    await expect(second.window.getByText('Job title: Persistence probe')).toBeVisible();
  } finally {
    await second.app.close();
  }
});

test('a fresh profile starts with an empty session', async () => {
  const { app, window } = await launchCareerCompass();
  try {
    await navigateTo(window, '/gap-analysis');
    await expect(window.getByPlaceholder(JOB_TITLE_PLACEHOLDER)).toHaveValue('');
  } finally {
    await app.close();
  }
});
