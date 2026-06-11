import { describe, it, expect } from 'vitest';
import { interviewFeedbackToExportDoc } from './interview-feedback';
import { toMarkdown } from '../to-markdown';
import type { InterviewFeedback } from '@/lib/session-store';

const feedback: InterviewFeedback = {
  target: 'Graduate analyst',
  difficulty: 'tough',
  summary: 'Strong start, rushed finish.',
  strengths: ['Clear STAR structure'],
  improvements: [
    {
      area: 'Quantify impact',
      why: 'Numbers stick',
      example: 'We cut load time by 40%…',
    },
    { area: 'Slow down', why: '', example: '' },
  ],
  perPhase: [
    { phase: 'warm-up', note: 'Relaxed and clear' },
    { phase: 'role-specific', note: 'Needed more depth' },
  ],
  overallRating: 'on-track',
  nextSteps: ['Practice two more behavioural answers'],
};

describe('interviewFeedbackToExportDoc', () => {
  it('renders difficulty, rating, strengths, improvements, phases, and next steps', () => {
    const md = toMarkdown(interviewFeedbackToExportDoc(feedback));
    expect(md).toContain('# Interview Feedback: Graduate analyst');
    expect(md).toContain('**Difficulty:** Tough');
    expect(md).toContain('**Overall rating:** On track');
    expect(md).toContain('- Clear STAR structure');
    expect(md).toContain('### 1. Quantify impact');
    expect(md).toContain('**Why it matters:** Numbers stick');
    expect(md).toContain('*We cut load time by 40%…*');
    expect(md).toContain('- **Warm-up:** Relaxed and clear');
    expect(md).toContain('- **Role-specific:** Needed more depth');
    expect(md).toContain('1. Practice two more behavioural answers');
  });

  it('skips optional improvement fields and renders sources when provided', () => {
    const md = toMarkdown(
      interviewFeedbackToExportDoc(
        { ...feedback, strengths: [], improvements: [feedback.improvements[1]], perPhase: [], nextSteps: [] },
        [{ title: 'Interview guide', url: 'https://example.com/i', domain: 'example.com' }]
      )
    );
    expect(md).not.toContain('What you did well');
    expect(md).not.toContain('Why it matters:');
    expect(md).not.toContain('By phase');
    expect(md).not.toContain('Next steps');
    expect(md).toContain('## Sources consulted');
    expect(md).toContain('[Interview guide](https://example.com/i) — example.com');
  });
});
