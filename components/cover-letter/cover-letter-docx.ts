import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { CoverLetter } from '@/lib/session-store';

export async function coverLetterToDocx(letter: CoverLetter): Promise<Blob> {
  const bodyParagraphs = letter.body
    .split('\n\n')
    .filter(Boolean)
    .map(
      (text) =>
        new Paragraph({
          children: [new TextRun({ text, size: 24, font: 'Calibri' })],
          spacing: { after: 200 },
        })
    );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: letter.greeting, size: 24, font: 'Calibri' }),
            ],
            spacing: { after: 200 },
          }),
          ...bodyParagraphs,
          new Paragraph({
            children: [
              new TextRun({ text: letter.closing, size: 24, font: 'Calibri' }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
