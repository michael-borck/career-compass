// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { isConfigured } = vi.hoisted(() => ({ isConfigured: vi.fn(async () => true) }));
vi.mock('../services/llm', () => ({ isConfigured }));
vi.mock('../services/careers', () => ({
  generateCareers: vi.fn(),
  elaborateCareer: vi.fn(),
}));

import Careers from './Careers';
import { useSessionStore } from '@/lib/session-store';

function renderCareers() {
  return render(
    <MemoryRouter>
      <Careers />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
  isConfigured.mockResolvedValue(true);
});

describe('Careers gating', () => {
  it('shows the provider setup card when no LLM is configured', async () => {
    isConfigured.mockResolvedValue(false);
    renderCareers();
    expect(await screen.findByText('Set up an AI provider')).toBeTruthy();
    expect(screen.getByText('Go to Settings')).toBeTruthy();
  });

  it('shows the input form when configured and no careers exist', async () => {
    renderCareers();
    // The setup card never appears; the input form does.
    expect(screen.queryByText('Set up an AI provider')).toBeNull();
    expect((await screen.findAllByText(/resume/i)).length).toBeGreaterThan(0);
  });
});
