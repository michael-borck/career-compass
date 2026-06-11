// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionBanner from './SessionBanner';
import { useSessionStore } from '@/lib/session-store';

function renderBanner() {
  return render(
    <MemoryRouter>
      <SessionBanner />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('SessionBanner visibility', () => {
  it('renders nothing for an empty session', () => {
    const { container } = renderBanner();
    expect(container.innerHTML).toBe('');
  });

  it('appears once any input is loaded', () => {
    useSessionStore.getState().setResume('my resume text', 'resume.pdf');
    renderBanner();
    expect(screen.getByText('resume.pdf')).toBeTruthy();
  });
});

describe('SessionBanner journey tracker', () => {
  it('starts at zero progress and suggests the first Discover activity', () => {
    useSessionStore.getState().setResume('my resume text', 'resume.pdf');
    renderBanner();
    expect(screen.getByText('Discover 0/3')).toBeTruthy();
    expect(screen.getByText('Assess 0/4')).toBeTruthy();
    expect(screen.getByText('Reflect 0/4')).toBeTruthy();
    expect(screen.getByText('Materials 0/4')).toBeTruthy();
    expect(screen.getByText('Find my careers →')).toBeTruthy();
  });

  it('counts completed activities per pillar and advances the suggestion', () => {
    const s = useSessionStore.getState();
    s.setCareers([{ jobTitle: 'Analyst' }] as never);
    s.setIndustryExploration({ industry: 'Mining' } as never);
    renderBanner();
    expect(screen.getByText('Discover 2/3')).toBeTruthy();
    expect(screen.getByText('Compare careers →')).toBeTruthy();
  });

  it('moves the suggestion into the next pillar once one is complete', () => {
    const s = useSessionStore.getState();
    s.setCareers([{ jobTitle: 'Analyst' }] as never);
    s.setIndustryExploration({ industry: 'Mining' } as never);
    s.setComparison({ targets: [] } as never);
    renderBanner();
    expect(screen.getByText('Discover 3/3')).toBeTruthy();
    expect(screen.getByText('Gap analysis →')).toBeTruthy();
  });
});
