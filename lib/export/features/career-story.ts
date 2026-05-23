// Career Story -> ExportDoc.
import type { CareerStory } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, note, disclaimer } from '../doc';

export function careerStoryToExportDoc(s: CareerStory): ExportDoc {
  const blocks: Block[] = [h2('The narrative')];
  for (const para of s.narrative.split('\n\n').filter(Boolean)) blocks.push(p(para));

  blocks.push(h2('Themes'));
  s.themes.forEach((t, i) => {
    blocks.push(h3(`${i + 1}. ${t.name}`));
    if (t.evidence.length > 0) {
      blocks.push(p(b('Evidence:')));
      blocks.push(bullets(t.evidence));
    }
    if (t.reflectionQuestion) blocks.push(note(t.reflectionQuestion));
  });

  blocks.push(
    disclaimer(
      'AI-generated career story. The themes are real patterns from your data. The narrative is a starting point — edit it to match your voice.'
    )
  );
  return { title: 'My Career Story', blocks };
}
