import { describe, it, expect } from 'vitest';
import { comparisonToExportDoc } from './compare';
import { toMarkdown } from '../to-markdown';
import type { Comparison, ComparisonRole } from '@/lib/session-store';

function role(label: string): ComparisonRole {
  return {
    label,
    cells: {
      typicalDay: `${label} day`,
      coreSkills: `${label} skills`,
      trainingNeeded: `${label} training`,
      salaryRange: `${label} salary`,
      workSetting: `${label} setting`,
      whoItSuits: `${label} fit`,
      mainChallenge: `${label} challenge`,
    },
  };
}

const comparison: Comparison = { mode: 'quick', roles: [role('Analyst'), role('Designer')] };

describe('comparisonToExportDoc', () => {
  it('renders the role list and every dimension with one line per role', () => {
    const md = toMarkdown(comparisonToExportDoc(comparison));
    expect(md).toContain('# Career Comparison');
    expect(md).toContain('1. Analyst');
    expect(md).toContain('2. Designer');
    for (const dim of [
      'Typical day',
      'Core skills',
      'Training needed',
      'Salary range',
      'Work setting',
      'Who it suits',
      'Main challenge',
    ]) {
      expect(md).toContain(`### ${dim}`);
    }
    expect(md).toContain('- **Analyst:** Analyst day');
    expect(md).toContain('- **Designer:** Designer challenge');
  });

  it('labels quick vs rich mode', () => {
    expect(toMarkdown(comparisonToExportDoc(comparison))).toContain('Quick compare');
    expect(toMarkdown(comparisonToExportDoc({ ...comparison, mode: 'rich' }))).toContain(
      'Rich compare'
    );
  });
});
