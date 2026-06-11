import { describe, it, expect } from 'vitest';
import { coverLetterToExportDoc } from './cover-letter';
import { toMarkdown } from '../to-markdown';
import type { CoverLetter } from '@/lib/session-store';

const letter: CoverLetter = {
  target: 'Graduate analyst at Acme',
  greeting: 'Dear hiring team,',
  body: 'First paragraph.\n\nSecond paragraph.',
  closing: 'Kind regards, Sam',
};

describe('coverLetterToExportDoc', () => {
  it('renders target, greeting, body paragraphs, and closing in order', () => {
    const md = toMarkdown(coverLetterToExportDoc(letter));
    expect(md).toContain('# Cover Letter');
    expect(md).toContain('**Target:** Graduate analyst at Acme');
    const greeting = md.indexOf('Dear hiring team,');
    const first = md.indexOf('First paragraph.');
    const second = md.indexOf('Second paragraph.');
    const closing = md.indexOf('Kind regards, Sam');
    expect(greeting).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(greeting);
    expect(second).toBeGreaterThan(first);
    expect(closing).toBeGreaterThan(second);
    expect(md).toContain('Edit before sending');
  });
});
