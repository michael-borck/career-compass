import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('has empty initial state', () => {
    const s = useSessionStore.getState();
    expect(s.resumeText).toBeNull();
    expect(s.resumeFilename).toBeNull();
    expect(s.freeText).toBe('');
    expect(s.jobTitle).toBe('');
    expect(s.chatMessages).toEqual([]);
    expect(s.currentFocus).toBeNull();
    expect(s.distilledProfile).toBeNull();
    expect(s.careers).toBeNull();
    expect(s.selectedCareerId).toBeNull();
  });
});
