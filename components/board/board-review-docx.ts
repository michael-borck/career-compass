import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { BoardReview } from '@/lib/session-store';

const FONT = 'Calibri';

type TextOpts = { bold?: boolean; italics?: boolean; size?: number; color?: string };

function text(t: string, opts?: TextOpts) {
  return new TextRun({ text: t, size: 24, font: FONT, ...opts });
}

function heading(level: typeof HeadingLevel[keyof typeof HeadingLevel], t: string, size: number) {
  return new Paragraph({
    children: [text(t, { bold: true, size })],
    heading: level,
    spacing: { before: 300, after: 200 },
  });
}

function bullet(t: string) {
  return new Paragraph({
    children: [text(`  •  ${t}`)],
    spacing: { after: 50 },
  });
}

export async function boardReviewToDocx(r: BoardReview): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Board of Advisors Review', 32));

  const framingLine = r.framing.trim() || 'Open review — no specific focus';
  children.push(new Paragraph({ children: [text('Your framing: ', { bold: true }), text(framingLine)], spacing: { after: 100 } }));
  children.push(new Paragraph({ children: [text('Focus role: ', { bold: true }), text(r.focusRole?.trim() || 'None')], spacing: { after: 200 } }));

  for (const voice of r.voices) {
    children.push(heading(HeadingLevel.HEADING_2, voice.name, 28));
    for (const para of voice.response.split('\n\n').filter(Boolean)) {
      children.push(new Paragraph({ children: [text(para)], spacing: { after: 200 } }));
    }
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Where the board landed', 28));

  if (r.synthesis.agreements.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'Where they agreed', 26));
    for (const a of r.synthesis.agreements) children.push(bullet(a));
  }

  if (r.synthesis.disagreements.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'Where they pushed back on each other', 26));
    for (const d of r.synthesis.disagreements) children.push(bullet(d));
  }

  if (r.synthesis.topPriorities.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'What to work on', 26));
    r.synthesis.topPriorities.forEach((p, i) => {
      children.push(new Paragraph({ children: [text(`${i + 1}. ${p}`)], spacing: { after: 50 } }));
    });
  }

  children.push(new Paragraph({
    children: [text('Four AI-generated perspectives. Disagreement is part of the exercise.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
