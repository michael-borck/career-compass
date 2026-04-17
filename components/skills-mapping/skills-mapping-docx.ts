import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { SkillsMapping, SkillFrameworkMapping, FrameworkLevel } from '@/lib/session-store';

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

function frameworkLine(label: string, fw: FrameworkLevel): Paragraph | null {
  if (!fw) return null;
  const desc = fw.description ? ` (${fw.description})` : '';
  return new Paragraph({
    children: [
      text(`  •  ${label}: `, { bold: true }),
      text(`${fw.name} — Level ${fw.level}${desc}`),
    ],
    spacing: { after: 50 },
  });
}

function renderSkill(children: Paragraph[], m: SkillFrameworkMapping) {
  children.push(heading(HeadingLevel.HEADING_3, m.skill, 26));

  children.push(new Paragraph({
    children: [text('Professional phrasing: ', { bold: true }), text(`"${m.professionalPhrase}"`)],
    spacing: { after: 150 },
  }));

  const frameworks = [
    frameworkLine('SFIA (AU/UK Digital)', m.sfia),
    frameworkLine('O*NET (US Broad)', m.onet),
    frameworkLine('ESCO (European)', m.esco),
    frameworkLine('AQF (AU Qualifications)', m.aqf),
  ];

  for (const f of frameworks) {
    if (f) children.push(f);
  }

  if (m.nextLevel) {
    children.push(new Paragraph({
      children: [text('To level up: ', { bold: true }), text(m.nextLevel)],
      spacing: { before: 100, after: 100 },
    }));
  }
}

export async function skillsMappingToDocx(mapping: SkillsMapping): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Skills Mapping', 32));

  children.push(new Paragraph({ children: [text(mapping.summary)], spacing: { after: 200 } }));

  if (mapping.frameworkNotes) {
    children.push(heading(HeadingLevel.HEADING_2, 'About these frameworks', 28));
    children.push(new Paragraph({ children: [text(mapping.frameworkNotes)], spacing: { after: 200 } }));
  }

  children.push(heading(HeadingLevel.HEADING_2, `Skills (${mapping.mappings.length})`, 28));

  for (const m of mapping.mappings) {
    renderSkill(children, m);
  }

  children.push(new Paragraph({
    children: [text('AI-generated mapping. These are approximate — based on AI interpretation, not certified assessment.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
