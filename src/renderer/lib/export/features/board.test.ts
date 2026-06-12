import { describe, it, expect } from 'vitest';
import { boardReviewToExportDoc } from './board';
import { toMarkdown } from '../to-markdown';
import type { BoardReview } from '@/lib/session-store';

const review: BoardReview = {
  framing: 'Worried my degree is too academic',
  focusRole: 'Data analyst',
  voices: [
    { role: 'recruiter', name: 'Riley (Recruiter)', response: 'First take.\n\nSecond thought.' },
    { role: 'mentor', name: 'Morgan (Mentor)', response: 'Long view.' },
  ],
  synthesis: {
    agreements: ['Projects beat grades'],
    disagreements: ['How fast to specialise'],
    topPriorities: ['Build a portfolio piece'],
  },
};

describe('boardReviewToExportDoc', () => {
  it('renders framing, focus role, every voice, and the synthesis', () => {
    const md = toMarkdown(boardReviewToExportDoc(review));
    expect(md).toContain('# Board of Advisors Review');
    expect(md).toContain('**Your framing:** Worried my degree is too academic');
    expect(md).toContain('**Focus role:** Data analyst');
    expect(md).toContain('## Riley (Recruiter)');
    expect(md).toContain('First take.');
    expect(md).toContain('Second thought.');
    expect(md).toContain('## Morgan (Mentor)');
    expect(md).toContain('### Where they agreed');
    expect(md).toContain('- Projects beat grades');
    expect(md).toContain('### Where they pushed back on each other');
    expect(md).toContain('1. Build a portfolio piece');
  });

  it('falls back for empty framing/focus and skips empty synthesis sections', () => {
    const md = toMarkdown(
      boardReviewToExportDoc({
        ...review,
        framing: '  ',
        focusRole: null,
        synthesis: { agreements: [], disagreements: [], topPriorities: [] },
      })
    );
    expect(md).toContain('Open review — no specific focus');
    expect(md).toContain('**Focus role:** None');
    expect(md).not.toContain('Where they agreed');
    expect(md).not.toContain('Where they pushed back');
    expect(md).not.toContain('What to work on');
  });
});
