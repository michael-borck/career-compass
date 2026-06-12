import { describe, it, expect } from 'vitest';
import { skillsMappingToExportDoc } from './skills-mapping';
import { toMarkdown } from '../to-markdown';
import type { SkillsMapping } from '@/lib/session-store';

const mapping: SkillsMapping = {
  summary: 'Strong analytical core.',
  frameworkNotes: 'Frameworks differ by region.',
  mappings: [
    {
      skill: 'Data analysis',
      sfia: { name: 'Data analysis', level: '3', description: 'Applies tools' },
      onet: { name: 'Analyzing Data', level: 'High', description: '' },
      esco: null,
      aqf: null,
      professionalPhrase: 'Performed exploratory data analysis',
      nextLevel: 'Own an analysis end to end',
    },
  ],
};

describe('skillsMappingToExportDoc', () => {
  it('renders summary, notes, and per-skill framework mappings', () => {
    const md = toMarkdown(skillsMappingToExportDoc(mapping));
    expect(md).toContain('# Skills Mapping');
    expect(md).toContain('Strong analytical core.');
    expect(md).toContain('## About these frameworks');
    expect(md).toContain('### Data analysis');
    expect(md).toContain('**Professional phrasing:** "Performed exploratory data analysis"');
    expect(md).toContain('- **SFIA (AU/UK Digital):** Data analysis — Level 3 (Applies tools)');
    expect(md).toContain('- **O*NET (US Broad):** Analyzing Data — Level High');
    expect(md).not.toContain('ESCO');
    expect(md).toContain('**To level up:** Own an analysis end to end');
  });

  it('omits framework notes and next-level when empty', () => {
    const md = toMarkdown(
      skillsMappingToExportDoc({
        ...mapping,
        frameworkNotes: '',
        mappings: [{ ...mapping.mappings[0], nextLevel: '' }],
      })
    );
    expect(md).not.toContain('About these frameworks');
    expect(md).not.toContain('To level up:');
  });
});
