import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { ElevatorPitch } from '@/lib/session-store';

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

export async function pitchToDocx(p: ElevatorPitch): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Elevator Pitch', 32));

  children.push(new Paragraph({
    children: [text('Target: ', { bold: true }), text(p.target ?? 'General')],
    spacing: { after: 200 },
  }));

  children.push(heading(HeadingLevel.HEADING_2, 'Your hook', 28));
  children.push(new Paragraph({ children: [text(p.hook)], spacing: { after: 200 } }));

  children.push(heading(HeadingLevel.HEADING_2, 'The pitch', 28));
  for (const para of p.body.split('\n\n').filter(Boolean)) {
    children.push(new Paragraph({ children: [text(para)], spacing: { after: 200 } }));
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Your close', 28));
  children.push(new Paragraph({ children: [text(p.close)], spacing: { after: 200 } }));

  children.push(heading(HeadingLevel.HEADING_2, 'Full script', 28));
  for (const para of p.fullScript.split('\n\n').filter(Boolean)) {
    children.push(new Paragraph({ children: [text(para)], spacing: { after: 200 } }));
  }

  children.push(new Paragraph({
    children: [text('AI-generated pitch. Edit to match your voice before using.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
