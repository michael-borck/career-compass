// Values Compass -> ExportDoc.
import type { ValuesCompass } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, note, disclaimer } from '../doc';

export function valuesCompassToExportDoc(c: ValuesCompass): ExportDoc {
  const blocks: Block[] = [p(c.summary), h2('Your values, ranked')];

  for (const v of c.values) {
    blocks.push(h3(`${v.rank}. ${v.name}`));
    blocks.push(p(v.description));
    if (v.evidence) blocks.push(p(b('Why we think this:'), ` ${v.evidence}`));
    if (v.reflectionQuestion) blocks.push(note(v.reflectionQuestion));
  }

  if (c.tensions.length > 0) {
    blocks.push(h2('Tensions to explore'));
    blocks.push(bullets(c.tensions, '⟷'));
  }

  blocks.push(
    disclaimer('AI-inferred values. Treat as a starting point for reflection, not a personality test.')
  );

  return { title: 'Values Compass', blocks };
}
