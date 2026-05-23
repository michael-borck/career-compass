// Skills Mapping -> ExportDoc.
import type { SkillsMapping, FrameworkLevel } from '@/lib/session-store';
import { type ExportDoc, type Block, type Inline, b, h2, h3, p, bullets, disclaimer } from '../doc';

function frameworkItem(label: string, fw: FrameworkLevel): Inline[] | null {
  if (!fw) return null;
  return [
    b(`${label}:`),
    ` ${fw.name} — Level ${fw.level}${fw.description ? ` (${fw.description})` : ''}`,
  ];
}

export function skillsMappingToExportDoc(m: SkillsMapping): ExportDoc {
  const blocks: Block[] = [p(m.summary)];

  if (m.frameworkNotes) {
    blocks.push(h2('About these frameworks'));
    blocks.push(p(m.frameworkNotes));
  }

  blocks.push(h2('Skills'));
  for (const s of m.mappings) {
    blocks.push(h3(s.skill));
    blocks.push(p(b('Professional phrasing:'), ` "${s.professionalPhrase}"`));

    const frameworks = [
      frameworkItem('SFIA (AU/UK Digital)', s.sfia),
      frameworkItem('O*NET (US Broad)', s.onet),
      frameworkItem('ESCO (European)', s.esco),
      frameworkItem('AQF (AU Qualifications)', s.aqf),
    ].filter((x): x is Inline[] => x !== null);
    if (frameworks.length > 0) blocks.push(bullets(frameworks));

    if (s.nextLevel) blocks.push(p(b('To level up:'), ` ${s.nextLevel}`));
  }

  blocks.push(
    disclaimer(
      'AI-generated mapping. These are approximate — based on AI interpretation, not certified assessment.'
    )
  );
  return { title: 'Skills Mapping', blocks };
}
