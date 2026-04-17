import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { IndustryExploration } from '@/lib/session-store';

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

function bullet(t: string, prefix = '•') {
  return new Paragraph({
    children: [text(`  ${prefix}  ${t}`)],
    spacing: { after: 50 },
  });
}

export async function industryExplorationToDocx(e: IndustryExploration): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, `Industry Exploration: ${e.industry}`, 32));

  children.push(heading(HeadingLevel.HEADING_2, 'Overview', 28));
  for (const para of e.overview.split('\n\n').filter(Boolean)) {
    children.push(new Paragraph({ children: [text(para)], spacing: { after: 200 } }));
  }

  children.push(heading(HeadingLevel.HEADING_2, 'Key roles', 28));
  for (const role of e.keyRoles) {
    const entryTag = role.entryLevel ? ' [Entry-level friendly]' : '';
    children.push(new Paragraph({
      children: [text(`${role.title}${entryTag}`, { bold: true }), text(` — ${role.description}`)],
      spacing: { after: 100 },
    }));
  }

  if (e.entryPoints.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'How to break in', 28));
    for (const ep of e.entryPoints) children.push(bullet(ep, '→'));
  }

  if (e.growthAreas.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, "What's growing", 28));
    for (const g of e.growthAreas) children.push(bullet(g, '↑'));
  }

  if (e.dayInTheLife) {
    children.push(heading(HeadingLevel.HEADING_2, 'A day in the life', 28));
    children.push(new Paragraph({ children: [text(e.dayInTheLife)], spacing: { after: 200 } }));
  }

  if (e.skillsInDemand.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Skills in demand', 28));
    for (const s of e.skillsInDemand) children.push(bullet(s));
  }

  if (e.challenges.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Challenges to know about', 28));
    for (const c of e.challenges) children.push(bullet(c));
  }

  children.push(new Paragraph({
    children: [text('AI-generated overview. Verify specific claims before making decisions.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
