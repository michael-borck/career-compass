import { describe, it, expect } from 'vitest';
import { toMarkdown } from './to-markdown';
import { type ExportDoc, b, it as italic, h2, h3, p, bullets, note, disclaimer } from './doc';

describe('toMarkdown', () => {
  it('renders the title as an H1', () => {
    expect(toMarkdown({ title: 'Cover Letter', blocks: [] })).toBe('# Cover Letter\n');
  });

  it('renders heading levels as ## and ###', () => {
    const doc: ExportDoc = { title: 'T', blocks: [h2('Section'), h3('Sub')] };
    expect(toMarkdown(doc)).toBe('# T\n\n## Section\n\n### Sub\n');
  });

  it('joins paragraph runs and applies bold / italic markers', () => {
    const doc: ExportDoc = { title: 'T', blocks: [p(b('Target:'), ' Acme'), p(italic('aside'))] };
    expect(toMarkdown(doc)).toBe('# T\n\n**Target:** Acme\n\n*aside*\n');
  });

  it('renders bullets as a dash list', () => {
    const doc: ExportDoc = { title: 'T', blocks: [bullets(['one', 'two'])] };
    expect(toMarkdown(doc)).toBe('# T\n\n- one\n- two\n');
  });

  it('renders a note in italics', () => {
    expect(toMarkdown({ title: 'T', blocks: [note('heads up')] })).toBe('# T\n\n*heads up*\n');
  });

  it('renders a disclaimer behind a horizontal rule', () => {
    const doc: ExportDoc = { title: 'T', blocks: [disclaimer('AI-generated.')] };
    expect(toMarkdown(doc)).toBe('# T\n\n---\n\n*AI-generated.*\n');
  });

  it('separates blocks with blank lines', () => {
    const doc: ExportDoc = { title: 'T', blocks: [p('a'), p('b')] };
    expect(toMarkdown(doc)).toBe('# T\n\na\n\nb\n');
  });
});
