import { describe, it, expect } from 'vitest';
import { resumeReviewToExportDoc } from './resume-review';
import { toMarkdown } from '../to-markdown';
import type { ResumeReview } from '@/lib/session-store';

const review: ResumeReview = {
  target: 'Data analyst',
  overallImpression: 'Solid base.\n\nNeeds sharper outcomes.',
  strengths: ['Clean layout'],
  improvements: [
    {
      section: 'Experience',
      suggestion: 'Lead with impact',
      why: 'Recruiters skim',
      example: 'Cut reporting time by 30%',
    },
    { section: 'Education', suggestion: 'Trim detail', why: '', example: '' },
  ],
  keywordsToAdd: ['SQL'],
  structuralNotes: ['Move skills above education'],
};

describe('resumeReviewToExportDoc', () => {
  it('renders target, impression, strengths, numbered improvements, keywords, and notes', () => {
    const md = toMarkdown(resumeReviewToExportDoc(review));
    expect(md).toContain('# Resume Review');
    expect(md).toContain('**Target:** Data analyst');
    expect(md).toContain('Solid base.');
    expect(md).toContain("## What's working");
    expect(md).toContain('### 1. Experience');
    expect(md).toContain('**Suggestion:** Lead with impact');
    expect(md).toContain('**Example:** "Cut reporting time by 30%"');
    expect(md).toContain('### 2. Education');
    expect(md).toContain('- SQL');
    expect(md).toContain('- Move skills above education');
  });

  it('falls back to General review and omits empty sections', () => {
    const md = toMarkdown(
      resumeReviewToExportDoc({
        ...review,
        target: null,
        strengths: [],
        keywordsToAdd: [],
        structuralNotes: [],
      })
    );
    expect(md).toContain('**Target:** General review');
    expect(md).not.toContain("What's working");
    expect(md).not.toContain('Keywords to add');
    expect(md).not.toContain('Structural notes');
  });
});
