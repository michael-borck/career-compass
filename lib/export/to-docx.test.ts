import { describe, it, expect } from 'vitest';
import { Document } from 'docx';
import { buildDocument, toDocx } from './to-docx';
import { type ExportDoc, b, it as italic, h2, h3, p, bullets, note, disclaimer } from './doc';

// A doc exercising every block type, so the renderer is smoke-tested across
// all of them. docx output is binary, so we assert on the structure
// (buildDocument) and that packing produces a non-empty Blob (toDocx).
const sample: ExportDoc = {
  title: 'Everything',
  blocks: [
    p(b('Target:'), ' Acme'),
    h2('Section'),
    p('A paragraph.'),
    h3('Sub'),
    bullets(['one', 'two']),
    note('an aside'),
    disclaimer('AI-generated.'),
  ],
};

describe('buildDocument', () => {
  it('builds a docx Document across all block types without throwing', () => {
    expect(buildDocument(sample)).toBeInstanceOf(Document);
  });

  it('also handles paragraphs with italic runs', () => {
    const doc: ExportDoc = { title: 'T', blocks: [p(italic('x'))] };
    expect(buildDocument(doc)).toBeInstanceOf(Document);
  });
});

describe('toDocx', () => {
  it('packs the document into a non-empty Blob', async () => {
    const blob = await toDocx(sample);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
