// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import NextSteps from './NextSteps';

beforeEach(() => {
  navigate.mockReset();
});

describe('NextSteps', () => {
  it('renders nothing when there are no steps', () => {
    const { container } = render(<NextSteps steps={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a card per step with title and description', () => {
    render(
      <NextSteps
        steps={[
          { title: 'Learning path', description: 'Close the gaps.', path: '/learning-path' },
          { title: 'Practice interview', description: 'Rehearse.', path: '/interview' },
        ]}
      />
    );
    expect(screen.getByText('What’s next?')).toBeTruthy();
    expect(screen.getByText('Learning path')).toBeTruthy();
    expect(screen.getByText('Practice interview')).toBeTruthy();
    expect(screen.getByText('Close the gaps.')).toBeTruthy();
  });

  it('clicking a step calls preNavigate before navigating to its path', () => {
    const calls: string[] = [];
    const preNavigate = vi.fn(() => calls.push('pre'));
    navigate.mockImplementation(() => calls.push('nav'));
    render(
      <NextSteps
        steps={[{ title: 'Cover letter', description: 'Draft it.', path: '/cover-letter', preNavigate }]}
      />
    );
    fireEvent.click(screen.getByText('Cover letter'));
    expect(navigate).toHaveBeenCalledWith('/cover-letter');
    expect(calls).toEqual(['pre', 'nav']);
  });
});
