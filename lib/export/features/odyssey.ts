// Odyssey Plan -> ExportDoc. Three lives, each with an optional elaboration
// and a self-rated dashboard.
import type { OdysseyLife, OdysseyLifeType, OdysseyDashboard } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, note, disclaimer } from '../doc';

const LIFE_LABELS: Record<OdysseyLifeType, { index: number; fallback: string }> = {
  current: { index: 1, fallback: 'Current Path' },
  pivot: { index: 2, fallback: 'The Pivot' },
  wildcard: { index: 3, fallback: 'The Wildcard' },
};

const DASHBOARD_ROWS: { field: keyof OdysseyDashboard; label: string; question: string }[] = [
  { field: 'resources', label: 'Resources', question: "do I have what I'd need to make this happen?" },
  { field: 'likability', label: 'Likability', question: 'do I actually like the sound of this?' },
  { field: 'confidence', label: 'Confidence', question: 'am I confident I could make it work?' },
  { field: 'coherence', label: 'Coherence', question: "does it fit who I'm becoming?" },
];

function dashboardBlocks(d: OdysseyDashboard): Block[] {
  const items = DASHBOARD_ROWS.map((row) => {
    const value = d[row.field];
    const tail = value === null ? '— not yet rated' : `${value}/5 — ${row.question}`;
    return [b(`${row.label}:`), ` ${tail}`];
  });
  return [h3('How does this feel?'), bullets(items)];
}

function lifeBlocks(life: OdysseyLife): Block[] {
  const { index, fallback } = LIFE_LABELS[life.type];
  const label = life.label.trim() || fallback;
  const blocks: Block[] = [h2(`Life ${index} — ${fallback}: ${label}`)];

  if (!life.headline && !life.dayInTheLife) {
    if (life.seed.trim()) blocks.push(p(b('Seed:'), ` ${life.seed.trim()}`));
    blocks.push(note('(This life has not been elaborated yet.)'));
    blocks.push(...dashboardBlocks(life.dashboard));
    return blocks;
  }

  if (life.headline) blocks.push(p(b(life.headline)));
  if (life.dayInTheLife) {
    blocks.push(h3('A day in 2030'));
    blocks.push(p(life.dayInTheLife));
  }
  if (life.typicalWeek.length > 0) {
    blocks.push(h3('Typical week'));
    blocks.push(bullets(life.typicalWeek));
  }
  if (life.toolsAndSkills.length > 0) {
    blocks.push(h3('Tools & skills'));
    blocks.push(bullets(life.toolsAndSkills));
  }
  if (life.whoYouWorkWith) {
    blocks.push(h3('Who you work with'));
    blocks.push(p(life.whoYouWorkWith));
  }
  if (life.challenges.length > 0) {
    blocks.push(h3('Challenges'));
    blocks.push(bullets(life.challenges));
  }
  if (life.questionsToExplore.length > 0) {
    blocks.push(h3('Questions to explore'));
    blocks.push(bullets(life.questionsToExplore));
  }
  blocks.push(...dashboardBlocks(life.dashboard));
  return blocks;
}

export function odysseyPlanToExportDoc(lives: Record<OdysseyLifeType, OdysseyLife>): ExportDoc {
  const order: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];
  const blocks: Block[] = [];
  for (const type of order) blocks.push(...lifeBlocks(lives[type]));
  blocks.push(disclaimer('AI-generated elaboration. Dashboard ratings are your own reflection.'));
  return { title: 'Odyssey Plan: Three Alternative Lives', blocks };
}
