// Renders an ExportDoc to a .docx Blob via the `docx` library. One of the two
// ExportDoc adapters (see to-markdown.ts for the other). The styling
// conventions (Calibri, heading sizes 32/28/26 by level, "  •  " bullets, the
// small grey disclaimer) match what the per-feature *-docx.ts builders used.
//
// buildDocument() is split out so it can be unit-tested without Packer/Blob.

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { ExportDoc, Block, Inline } from './doc';

const FONT = 'Calibri';

function run(inline: Inline): TextRun {
  if (typeof inline === 'string') {
    return new TextRun({ text: inline, size: 24, font: FONT });
  }
  return new TextRun({
    text: inline.text,
    size: 24,
    font: FONT,
    bold: inline.bold,
    italics: inline.italic,
  });
}

function blockToParagraphs(block: Block): Paragraph[] {
  switch (block.kind) {
    case 'heading': {
      const size = block.level === 2 ? 28 : 26;
      const level = block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, size, font: FONT, bold: true })],
          heading: level,
          spacing: { before: 300, after: 200 },
        }),
      ];
    }
    case 'paragraph':
      return [new Paragraph({ children: block.runs.map(run), spacing: { after: 200 } })];
    case 'bullets':
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [new TextRun({ text: `  •  ${item}`, size: 24, font: FONT })],
            spacing: { after: 50 },
          })
      );
    case 'note':
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, size: 24, font: FONT, italics: true })],
          spacing: { after: 150 },
        }),
      ];
    case 'disclaimer':
      return [
        new Paragraph({
          children: [
            new TextRun({ text: block.text, size: 20, font: FONT, italics: true, color: '666666' }),
          ],
          spacing: { before: 400 },
        }),
      ];
  }
}

export function buildDocument(doc: ExportDoc): Document {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: doc.title, size: 32, font: FONT, bold: true })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    }),
  ];
  for (const block of doc.blocks) children.push(...blockToParagraphs(block));
  return new Document({ sections: [{ children }] });
}

export async function toDocx(doc: ExportDoc): Promise<Blob> {
  return Packer.toBlob(buildDocument(doc));
}
