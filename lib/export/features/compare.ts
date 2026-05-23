// Career Comparison -> ExportDoc. Renders as dimension-grouped lists (a heading
// per dimension, one line per role) — the same shape both old exporters used,
// so no table block is needed.
import type { Comparison, ComparisonDimension } from '@/lib/session-store';
import { type ExportDoc, type Block, b, it, h2, h3, p, bullets, disclaimer } from '../doc';

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
  'typicalDay',
  'coreSkills',
  'trainingNeeded',
  'salaryRange',
  'workSetting',
  'whoItSuits',
  'mainChallenge',
];

export function comparisonToExportDoc(c: Comparison): ExportDoc {
  const modeRuns =
    c.mode === 'quick'
      ? [b('Mode:'), ' Quick compare ', it('(LLM-generated from job titles — vague, makes assumptions)')]
      : [b('Mode:'), ' Rich compare ', it('(based on careers from your spider graph)')];

  const blocks: Block[] = [p(...modeRuns), h2('Roles compared')];
  c.roles.forEach((role, i) => blocks.push(p(`${i + 1}. ${role.label}`)));

  blocks.push(h2('Comparison'));
  for (const dim of DIMENSION_ORDER) {
    blocks.push(h3(DIMENSION_LABELS[dim]));
    blocks.push(bullets(c.roles.map((role) => [b(`${role.label}:`), ` ${role.cells[dim]}`])));
  }

  blocks.push(
    disclaimer(
      'AI-generated comparison. Treat specific salary figures and training timelines as starting points, not guarantees.'
    )
  );
  return { title: 'Career Comparison', blocks };
}
