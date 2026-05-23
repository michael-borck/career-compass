import { describe, it, expect } from 'vitest';
import { toMarkdown } from './to-markdown';
import { type ExportDoc, b, it as italic, h2, h3, p, bullets, note, sources, disclaimer } from './doc';

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

  it('ignores the docx bullet marker (markdown always uses -)', () => {
    expect(toMarkdown({ title: 'T', blocks: [bullets(['x'], '→')] })).toBe('# T\n\n- x\n');
  });

  it('renders rich bullet items with bold labels', () => {
    const doc: ExportDoc = { title: 'T', blocks: [bullets([[b('Resources:'), ' 4/5']])] };
    expect(toMarkdown(doc)).toBe('# T\n\n- **Resources:** 4/5\n');
  });

  it('renders sources as a numbered markdown link list', () => {
    const doc: ExportDoc = { title: 'T', blocks: [sources([{ title: 'A', url: 'http://a', domain: 'a.com' }])] };
    expect(toMarkdown(doc)).toBe('# T\n\n1. [A](http://a) — a.com\n');
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
