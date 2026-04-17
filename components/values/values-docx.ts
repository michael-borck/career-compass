import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { ValuesCompass } from '@/lib/session-store';

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

export async function valuesCompassToDocx(compass: ValuesCompass): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Values Compass', 32));

  children.push(new Paragraph({ children: [text(compass.summary)], spacing: { after: 200 } }));

  children.push(heading(HeadingLevel.HEADING_2, 'Your values, ranked', 28));

  for (const v of compass.values) {
    children.push(heading(HeadingLevel.HEADING_3, `${v.rank}. ${v.name}`, 26));
    children.push(new Paragraph({ children: [text(v.description)], spacing: { after: 100 } }));
    if (v.evidence) {
      children.push(new Paragraph({
        children: [text('Why we think this: ', { bold: true }), text(v.evidence)],
        spacing: { after: 100 },
      }));
    }
    if (v.reflectionQuestion) {
      children.push(new Paragraph({
        children: [text(v.reflectionQuestion, { italics: true })],
        spacing: { after: 150 },
        indent: { left: 400 },
      }));
    }
  }

  if (compass.tensions.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Tensions to explore', 28));
    for (const t of compass.tensions) {
      children.push(new Paragraph({
        children: [text(`  ⟷  ${t}`)],
        spacing: { after: 50 },
      }));
    }
  }

  children.push(new Paragraph({
    children: [text('AI-inferred values. Treat as a starting point for reflection, not a personality test.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
