import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { GapAnalysis, SourceRef } from '@/lib/session-store';

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

export async function gapAnalysisToDocx(g: GapAnalysis, sources?: SourceRef[]): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, `Gap Analysis: ${g.target}`, 32));

  children.push(new Paragraph({ children: [text(g.summary)], spacing: { after: 200 } }));

  if (g.matches.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'What you already have', 28));
    for (const m of g.matches) children.push(bullet(m));
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Gaps', 28));

  for (const gap of g.gaps) {
    children.push(heading(HeadingLevel.HEADING_3, `[${gap.severity.toUpperCase()}] ${gap.title}`, 26));
    if (gap.why) children.push(new Paragraph({ children: [text('Why it matters: ', { bold: true }), text(gap.why)], spacing: { after: 100 } }));
    if (gap.targetLevel) children.push(new Paragraph({ children: [text('Target level: ', { bold: true }), text(gap.targetLevel)], spacing: { after: 100 } }));
    if (gap.currentLevel) children.push(new Paragraph({ children: [text('Current level: ', { bold: true }), text(gap.currentLevel)], spacing: { after: 100 } }));
    if (gap.evidenceIdeas.length > 0) {
      children.push(new Paragraph({ children: [text('How to demonstrate:', { bold: true })], spacing: { after: 50 } }));
      for (const e of gap.evidenceIdeas) children.push(bullet(e));
    }
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Rough timeline', 28));
  children.push(new Paragraph({ children: [text(g.realisticTimeline)], spacing: { after: 200 } }));

  if (sources && sources.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Sources', 28));
    sources.forEach((s, i) => {
      children.push(new Paragraph({ children: [text(`${i + 1}. ${s.title} — ${s.domain}`)], spacing: { after: 50 } }));
    });
  }

  children.push(new Paragraph({
    children: [text('AI-generated. Verify suggestions against your own situation.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
