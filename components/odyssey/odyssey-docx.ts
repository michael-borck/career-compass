import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { OdysseyLife, OdysseyLifeType, OdysseyDashboard } from '@/lib/session-store';

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

const LIFE_LABELS: Record<OdysseyLifeType, { index: number; fallback: string }> = {
  current: { index: 1, fallback: 'Current Path' },
  pivot: { index: 2, fallback: 'The Pivot' },
  wildcard: { index: 3, fallback: 'The Wildcard' },
};

const DASHBOARD_ROWS: { field: keyof OdysseyDashboard; label: string; question: string }[] = [
  { field: 'resources', label: 'Resources', question: 'do I have what I\'d need to make this happen?' },
  { field: 'likability', label: 'Likability', question: 'do I actually like the sound of this?' },
  { field: 'confidence', label: 'Confidence', question: 'am I confident I could make it work?' },
  { field: 'coherence', label: 'Coherence', question: 'does it fit who I\'m becoming?' },
];

function renderDashboard(children: Paragraph[], d: OdysseyDashboard) {
  children.push(heading(HeadingLevel.HEADING_3, 'How does this feel?', 26));
  for (const row of DASHBOARD_ROWS) {
    const value = d[row.field];
    const rating = value === null ? 'not yet rated' : `${value}/5 — ${row.question}`;
    children.push(bullet(`${row.label}: ${rating}`));
  }
}

function renderLife(children: Paragraph[], life: OdysseyLife) {
  const { index, fallback } = LIFE_LABELS[life.type];
  const label = life.label.trim() || fallback;

  children.push(heading(HeadingLevel.HEADING_2, `Life ${index} — ${fallback}: ${label}`, 28));

  if (!life.headline && !life.dayInTheLife) {
    if (life.seed.trim()) {
      children.push(new Paragraph({ children: [text('Seed: ', { bold: true }), text(life.seed.trim())], spacing: { after: 200 } }));
    }
    children.push(new Paragraph({ children: [text('(This life has not been elaborated yet.)', { italics: true })], spacing: { after: 200 } }));
    renderDashboard(children, life.dashboard);
    return;
  }

  if (life.headline) {
    children.push(new Paragraph({ children: [text(life.headline, { bold: true })], spacing: { after: 200 } }));
  }
  if (life.dayInTheLife) {
    children.push(heading(HeadingLevel.HEADING_3, 'A day in 2030', 26));
    children.push(new Paragraph({ children: [text(life.dayInTheLife)], spacing: { after: 200 } }));
  }
  if (life.typicalWeek.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'Typical week', 26));
    for (const w of life.typicalWeek) children.push(bullet(w));
  }
  if (life.toolsAndSkills.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'Tools & skills', 26));
    for (const t of life.toolsAndSkills) children.push(bullet(t));
  }
  if (life.whoYouWorkWith) {
    children.push(heading(HeadingLevel.HEADING_3, 'Who you work with', 26));
    children.push(new Paragraph({ children: [text(life.whoYouWorkWith)], spacing: { after: 200 } }));
  }
  if (life.challenges.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'Challenges', 26));
    for (const c of life.challenges) children.push(bullet(c));
  }
  if (life.questionsToExplore.length > 0) {
    children.push(heading(HeadingLevel.HEADING_3, 'Questions to explore', 26));
    for (const q of life.questionsToExplore) children.push(bullet(q));
  }

  renderDashboard(children, life.dashboard);
}

export async function odysseyPlanToDocx(lives: Record<OdysseyLifeType, OdysseyLife>): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, 'Odyssey Plan: Three Alternative Lives', 32));

  const order: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];
  for (const type of order) {
    renderLife(children, lives[type]);
  }

  children.push(new Paragraph({
    children: [text('AI-generated elaboration. Dashboard ratings are your own reflection.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
