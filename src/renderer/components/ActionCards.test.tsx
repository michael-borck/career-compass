// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import ActionCards from './ActionCards';
import { useSessionStore } from '@/lib/session-store';

beforeEach(() => {
  navigate.mockReset();
  useSessionStore.getState().reset();
});

describe('ActionCards layout', () => {
  it('renders the four pillars with 15 activity cards', () => {
    render(<ActionCards />);
    for (const pillar of ['Discover', 'Assess', 'Reflect', 'Materials']) {
      expect(screen.getByText(pillar)).toBeTruthy();
    }
    // Activity cards are the buttons that contain an h3 title.
    const cards = screen.getAllByRole('button').filter((b) => b.querySelector('h3'));
    expect(cards).toHaveLength(15);
  });

  it('marks exactly one capstone per pillar', () => {
    render(<ActionCards />);
    expect(screen.getAllByText('Capstone')).toHaveLength(4);
    // The capstones are the last card of each column.
    for (const title of [
      'Compare careers',
      'Practice interview',
      'Career story',
      'Portfolio page',
    ]) {
      const card = screen.getByText(title).closest('button')!;
      expect(card.textContent).toContain('Capstone');
    }
  });

  it('shows the chat banner above the pillars and navigates to /chat', () => {
    render(<ActionCards />);
    fireEvent.click(screen.getByText('Not sure where to start?'));
    expect(navigate).toHaveBeenCalledWith('/chat');
  });
});

describe('ActionCards behaviour', () => {
  it('clicking a card navigates to its route', () => {
    render(<ActionCards />);
    fireEvent.click(screen.getByText('Gap analysis'));
    expect(navigate).toHaveBeenCalledWith('/gap-analysis');
  });

  it('"Find my careers" clears existing careers before navigating', () => {
    useSessionStore.getState().setCareers([{ jobTitle: 'Existing' } as never]);
    render(<ActionCards />);
    fireEvent.click(screen.getByText('Find my careers'));
    expect(useSessionStore.getState().careers).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/careers');
  });

  it('"Compare careers" seeds the compare prefill from the job target', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    render(<ActionCards />);
    fireEvent.click(screen.getByText('Compare careers'));
    expect(useSessionStore.getState().comparePrefill).toEqual({ seedTarget: 'Data analyst' });
    expect(navigate).toHaveBeenCalledWith('/compare');
  });
});
