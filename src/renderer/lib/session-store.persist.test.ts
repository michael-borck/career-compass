// @vitest-environment jsdom
//
// Persistence behaviour: the session store mirrors to localStorage so a
// session survives an app restart. These tests cover the write path, the
// transient-field exclusions, and rehydration from a stored session.

import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore, SESSION_STORAGE_KEY } from './session-store';

function persisted() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  useSessionStore.getState().reset();
  localStorage.clear();
});

describe('session persistence', () => {
  it('mirrors state changes to localStorage', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    useSessionStore.getState().setResume('resume body', 'resume.pdf');
    const stored = persisted();
    expect(stored.state.jobTitle).toBe('Data analyst');
    expect(stored.state.resumeText).toBe('resume body');
    expect(stored.state.resumeFilename).toBe('resume.pdf');
    expect(stored.version).toBe(1);
  });

  it('does not persist one-shot navigation prefills', () => {
    useSessionStore.getState().setBoardPrefill({ framing: 'x', focusRole: 'y' });
    useSessionStore.getState().setComparePrefill({ seedTarget: 'z' });
    const stored = persisted();
    // In memory for the upcoming navigation…
    expect(useSessionStore.getState().boardPrefill).toEqual({ framing: 'x', focusRole: 'y' });
    // …but never written to disk.
    expect(stored.state.boardPrefill).toBeUndefined();
    expect(stored.state.comparePrefill).toBeUndefined();
  });

  it('reset clears the persisted session too', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    useSessionStore.getState().reset();
    expect(persisted().state.jobTitle).toBe('');
  });

  it('rehydrates a stored session and keeps actions working', async () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        state: { jobTitle: 'Restored role', freeText: 'about me' },
        version: 1,
      })
    );
    await useSessionStore.persist.rehydrate();
    expect(useSessionStore.getState().jobTitle).toBe('Restored role');
    expect(useSessionStore.getState().freeText).toBe('about me');
    // Actions survive the merge.
    useSessionStore.getState().setJobTitle('Changed');
    expect(useSessionStore.getState().jobTitle).toBe('Changed');
  });
});
