import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { ResumeReview } from '@/lib/session-store';

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

export async function resumeReviewToDocx(r: ResumeReview): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Resume Review', 32));

  children.push(new Paragraph({
    children: [text('Target: ', { bold: true }), text(r.target ?? 'General review')],
    spacing: { after: 200 },
  }));

  children.push(heading(HeadingLevel.HEADING_2, 'Overall impression', 28));
  for (const para of r.overallImpression.split('\n\n').filter(Boolean)) {
    children.push(new Paragraph({ children: [text(para)], spacing: { after: 200 } }));
  }

  if (r.strengths.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, "What's working", 28));
    for (const s of r.strengths) children.push(bullet(s));
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Suggested improvements', 28));

  r.improvements.forEach((imp, idx) => {
    children.push(heading(HeadingLevel.HEADING_3, `${idx + 1}. ${imp.section}`, 26));
    children.push(new Paragraph({ children: [text('Suggestion: ', { bold: true }), text(imp.suggestion)], spacing: { after: 100 } }));
    if (imp.why) children.push(new Paragraph({ children: [text('Why: ', { bold: true }), text(imp.why)], spacing: { after: 100 } }));
    if (imp.example) children.push(new Paragraph({ children: [text('Example: ', { bold: true }), text(`"${imp.example}"`)], spacing: { after: 100 } }));
  });

  if (r.keywordsToAdd.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Keywords to add', 28));
    for (const k of r.keywordsToAdd) children.push(bullet(k));
  }

  if (r.structuralNotes.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Structural notes', 28));
    for (const n of r.structuralNotes) children.push(bullet(n));
  }

  children.push(new Paragraph({
    children: [text('AI-generated feedback. Use as a starting point, not a final verdict.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
