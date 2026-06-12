// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Hero from './Hero';
import { useSessionStore } from '@/lib/session-store';
import { SAMPLE_FILENAME } from '@/lib/sample-data';

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('Hero sample profile', () => {
  it('offers the sample profile on an empty session and loads it on click', () => {
    render(<Hero />);
    fireEvent.click(screen.getByText('Load a sample profile'));
    const s = useSessionStore.getState();
    expect(s.resumeFilename).toBe(SAMPLE_FILENAME);
    expect(s.resumeText).toContain('Curtin University');
    expect(s.freeText).toContain('data science student');
    expect(s.jobTitle).toBe('Graduate data analyst');
  });

  it('hides the offer once a profile exists', () => {
    useSessionStore.getState().setResume('real resume', 'mine.pdf');
    render(<Hero />);
    expect(screen.queryByText('Load a sample profile')).toBeNull();
  });
});
