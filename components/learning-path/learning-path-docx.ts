import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { LearningPath, SourceRef } from '@/lib/session-store';

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

export async function learningPathToDocx(p: LearningPath, sources?: SourceRef[]): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, `Learning Path: ${p.target}`, 32));

  children.push(new Paragraph({ children: [text(p.summary)], spacing: { after: 200 } }));
  children.push(new Paragraph({ children: [text('Total duration: ', { bold: true }), text(p.totalDuration)], spacing: { after: 200 } }));

  if (p.prerequisites.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Before you start', 28));
    for (const pre of p.prerequisites) children.push(bullet(pre));
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Milestones', 28));

  for (const m of p.milestones) {
    children.push(heading(HeadingLevel.HEADING_3, `${m.weekRange} · ${m.focus}`, 26));
    if (m.activities.length > 0) {
      children.push(new Paragraph({ children: [text('Activities:', { bold: true })], spacing: { after: 50 } }));
      for (const a of m.activities) children.push(bullet(a));
    }
    if (m.outcome) {
      children.push(new Paragraph({ children: [text('Outcome: ', { bold: true }), text(m.outcome)], spacing: { before: 100, after: 100 } }));
    }
  }

  if (p.portfolioProject) {
    children.push(heading(HeadingLevel.HEADING_2, 'Portfolio project', 28));
    children.push(new Paragraph({ children: [text(p.portfolioProject)], spacing: { after: 200 } }));
  }

  if (p.caveats.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Caveats', 28));
    for (const c of p.caveats) children.push(bullet(c));
  }

  if (sources && sources.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Sources', 28));
    sources.forEach((s, i) => {
      children.push(new Paragraph({ children: [text(`${i + 1}. ${s.title} — ${s.domain}`)], spacing: { after: 50 } }));
    });
  }

  children.push(new Paragraph({
    children: [text('AI-generated. Treat specific course names as starting points, not final recommendations.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
