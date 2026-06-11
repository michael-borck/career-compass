// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/interview', () => ({
  runInterviewTurn: vi.fn(),
  generateInterviewFeedback: vi.fn(),
}));
vi.mock('../services/llm', () => ({ isConfigured: vi.fn(async () => true) }));

import Interview from './Interview';
import { useSessionStore, type InterviewFeedback } from '@/lib/session-store';

function renderInterview() {
  return render(
    <MemoryRouter>
      <Interview />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

describe('Interview state precedence', () => {
  it('shows the setup card on a fresh session', () => {
    renderInterview();
    expect(screen.getByText('Target role')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g., Data Analyst')).toBeTruthy();
  });

  it('prefills the target from the session job title', () => {
    useSessionStore.getState().setJobTitle('UX researcher');
    renderInterview();
    expect((screen.getByPlaceholderText('e.g., Data Analyst') as HTMLInputElement).value).toBe(
      'UX researcher'
    );
  });

  it('prefers the first line of a job advert over the job title', () => {
    useSessionStore.getState().setJobTitle('Fallback role');
    useSessionStore.getState().setJobAdvert('Senior Data Analyst\nat Acme Corp');
    renderInterview();
    expect((screen.getByPlaceholderText('e.g., Data Analyst') as HTMLInputElement).value).toBe(
      'Senior Data Analyst'
    );
  });

  it('shows the feedback view when feedback exists', () => {
    const feedback: InterviewFeedback = {
      target: 'Data analyst',
      difficulty: 'standard',
      summary: 'Good pacing overall.',
      strengths: ['Clear answers'],
      improvements: [],
      perPhase: [],
      overallRating: 'on-track',
      nextSteps: [],
    };
    useSessionStore.getState().setInterviewFeedback(feedback);
    renderInterview();
    expect(screen.getByText(/Practice interview · Data analyst · Standard/)).toBeTruthy();
    expect(screen.getByText('Good pacing overall.')).toBeTruthy();
    // Setup card is gone.
    expect(screen.queryByText('Target role')).toBeNull();
  });
});
