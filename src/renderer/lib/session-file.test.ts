// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { buildSessionFile, loadSessionFromFile, SESSION_FILE_VERSION } from './session-file';
import { useSessionStore } from './session-store';

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('session file round trip', () => {
  it('captures state, survives reset, and restores on load', () => {
    const s = useSessionStore.getState();
    s.setResume('resume body', 'mine.pdf');
    s.setJobTitle('Data analyst');
    s.setFreeText('about me');

    const file = buildSessionFile('2026-06-12T00:00:00.000Z');
    expect(file.app).toBe('career-compass');
    expect(file.version).toBe(SESSION_FILE_VERSION);
    expect(file.state.resumeText).toBe('resume body');

    useSessionStore.getState().reset();
    expect(useSessionStore.getState().resumeText).toBeNull();

    loadSessionFromFile(JSON.stringify(file));
    const restored = useSessionStore.getState();
    expect(restored.resumeText).toBe('resume body');
    expect(restored.resumeFilename).toBe('mine.pdf');
    expect(restored.jobTitle).toBe('Data analyst');
    expect(restored.freeText).toBe('about me');
    // Actions still work after load.
    restored.setJobTitle('Changed');
    expect(useSessionStore.getState().jobTitle).toBe('Changed');
  });

  it('excludes one-shot prefills from the snapshot and ignores them on load', () => {
    useSessionStore.getState().setBoardPrefill({ framing: 'x' });
    const file = buildSessionFile();
    expect('boardPrefill' in file.state).toBe(false);

    file.state.comparePrefill = { seedTarget: 'sneaky' };
    loadSessionFromFile(JSON.stringify(file));
    expect(useSessionStore.getState().comparePrefill).toBeNull();
  });

  it('ignores unknown keys so newer files degrade gracefully', () => {
    const file = buildSessionFile();
    file.state.futureFeature = { anything: true };
    loadSessionFromFile(JSON.stringify(file));
    expect('futureFeature' in useSessionStore.getState()).toBe(false);
  });

  it('loading replaces the whole session, not just the keys present', () => {
    useSessionStore.getState().setJobTitle('Should disappear');
    const file = buildSessionFile();
    delete file.state.jobTitle;
    loadSessionFromFile(JSON.stringify(file));
    expect(useSessionStore.getState().jobTitle).toBe('');
  });

  it('rejects non-JSON and non-session files with user-safe messages', () => {
    expect(() => loadSessionFromFile('not json')).toThrow(/not valid JSON/);
    expect(() => loadSessionFromFile('{"app":"other"}')).toThrow(/not a Career Compass session/);
    expect(() => loadSessionFromFile('null')).toThrow(/not a Career Compass session/);
  });
});
