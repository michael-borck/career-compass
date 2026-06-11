// @vitest-environment jsdom
//
// Pins the quick-compare seed path: a comparePrefill.seedTarget set on the
// landing page must land in Target 1 with the "(from landing)" tag, and the
// prefill must be consumed.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Compare from './Compare';
import { useSessionStore } from '@/lib/session-store';

const TARGET_PLACEHOLDER = 'Job title or paste a short job advert.';

function renderCompare() {
  return render(
    <MemoryRouter initialEntries={['/compare']}>
      <Compare />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('Compare seed prefill', () => {
  it('starts clean without a prefill', () => {
    renderCompare();
    const targets = screen.getAllByPlaceholderText(TARGET_PLACEHOLDER) as HTMLTextAreaElement[];
    expect(targets[0].value).toBe('');
    expect(screen.queryByText('(from landing)')).toBeNull();
  });

  it('seeds Target 1 from comparePrefill, shows the tag, and consumes the prefill', () => {
    useSessionStore.getState().setComparePrefill({ seedTarget: 'UX researcher' });
    renderCompare();
    const targets = screen.getAllByPlaceholderText(TARGET_PLACEHOLDER) as HTMLTextAreaElement[];
    expect(targets[0].value).toBe('UX researcher');
    expect(screen.getByText('(from landing)')).toBeTruthy();
    expect(useSessionStore.getState().comparePrefill).toBeNull();
  });

  it('ignores an empty seed', () => {
    useSessionStore.getState().setComparePrefill({ seedTarget: '' });
    renderCompare();
    const targets = screen.getAllByPlaceholderText(TARGET_PLACEHOLDER) as HTMLTextAreaElement[];
    expect(targets[0].value).toBe('');
    expect(screen.queryByText('(from landing)')).toBeNull();
  });
});
