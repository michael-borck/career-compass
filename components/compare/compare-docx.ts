import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { Comparison, ComparisonDimension } from '@/lib/session-store';

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

const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  typicalDay: 'Typical day',
  coreSkills: 'Core skills',
  trainingNeeded: 'Training needed',
  salaryRange: 'Salary range',
  workSetting: 'Work setting',
  whoItSuits: 'Who it suits',
  mainChallenge: 'Main challenge',
};

const DIMENSION_ORDER: ComparisonDimension[] = [
  'typicalDay', 'coreSkills', 'trainingNeeded', 'salaryRange',
  'workSetting', 'whoItSuits', 'mainChallenge',
];

export async function comparisonToDocx(c: Comparison): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Career Comparison', 32));

  const modeText = c.mode === 'quick'
    ? 'Quick compare (LLM-generated from job titles)'
    : 'Rich compare (based on careers from your spider graph)';
  children.push(new Paragraph({ children: [text('Mode: ', { bold: true }), text(modeText)], spacing: { after: 200 } }));

  children.push(heading(HeadingLevel.HEADING_2, 'Roles compared', 28));
  c.roles.forEach((role, i) => {
    children.push(new Paragraph({ children: [text(`${i + 1}. ${role.label}`)], spacing: { after: 50 } }));
  });

  children.push(heading(HeadingLevel.HEADING_2, 'Comparison', 28));

  for (const dim of DIMENSION_ORDER) {
    children.push(heading(HeadingLevel.HEADING_3, DIMENSION_LABELS[dim], 26));
    for (const role of c.roles) {
      children.push(new Paragraph({
        children: [text(`${role.label}: `, { bold: true }), text(role.cells[dim])],
        spacing: { after: 100 },
      }));
    }
  }

  children.push(new Paragraph({
    children: [text('AI-generated comparison. Treat specific salary figures and training timelines as starting points, not guarantees.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
