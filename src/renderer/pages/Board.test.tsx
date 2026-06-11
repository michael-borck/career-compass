// @vitest-environment jsdom
//
// Pins the "Run again" prefill behaviour: a boardPrefill in the session store
// must land in the framing/focus-role inputs exactly once, and be consumed so
// a later visit starts clean.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Board from './Board';
import { useSessionStore } from '@/lib/session-store';

const FRAMING_PLACEHOLDER =
  "e.g. I'm worried my degree feels too academic for industry data roles.";
const FOCUS_PLACEHOLDER = 'Graduate data analyst';

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/board']}>
      <Board />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('Board prefill', () => {
  it('starts with empty inputs when there is no prefill', () => {
    renderBoard();
    expect((screen.getByPlaceholderText(FRAMING_PLACEHOLDER) as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByPlaceholderText(FOCUS_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('fills the inputs from boardPrefill and consumes it', () => {
    useSessionStore.getState().setBoardPrefill({
      framing: 'Worried about industry fit',
      focusRole: 'Data analyst',
    });
    renderBoard();
    expect((screen.getByPlaceholderText(FRAMING_PLACEHOLDER) as HTMLTextAreaElement).value).toBe(
      'Worried about industry fit'
    );
    expect((screen.getByPlaceholderText(FOCUS_PLACEHOLDER) as HTMLInputElement).value).toBe(
      'Data analyst'
    );
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });
});
