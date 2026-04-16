import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { CareerStory } from '@/lib/session-store';

export async function careerStoryToDocx(story: CareerStory): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    children: [new TextRun({ text: 'My Career Story', bold: true, size: 32, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  }));

  children.push(new Paragraph({
    children: [new TextRun({ text: 'Generated from your Career Compass session', italics: true, size: 20, font: 'Calibri', color: '666666' })],
    spacing: { after: 400 },
  }));

  for (const text of story.narrative.split('\n\n').filter(Boolean)) {
    children.push(new Paragraph({
      children: [new TextRun({ text, size: 24, font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  children.push(new Paragraph({
    children: [new TextRun({ text: 'Themes', bold: true, size: 28, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
  }));

  for (const theme of story.themes) {
    children.push(new Paragraph({
      children: [new TextRun({ text: theme.name, bold: true, size: 24, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 100 },
    }));

    if (theme.evidence.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Evidence:', bold: true, size: 22, font: 'Calibri' })],
        spacing: { after: 50 },
      }));
      for (const e of theme.evidence) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `  •  ${e}`, size: 22, font: 'Calibri' })],
          spacing: { after: 50 },
        }));
      }
    }

    if (theme.reflectionQuestion) {
      children.push(new Paragraph({
        children: [new TextRun({ text: theme.reflectionQuestion, italics: true, size: 22, font: 'Calibri', color: '555555' })],
        spacing: { before: 100, after: 200 },
      }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
