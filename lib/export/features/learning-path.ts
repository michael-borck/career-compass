// Learning Path -> ExportDoc. Takes optional grounding sources.
import type { LearningPath, SourceRef } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, sources, disclaimer } from '../doc';

export function learningPathToExportDoc(pth: LearningPath, srcs?: SourceRef[]): ExportDoc {
  const blocks: Block[] = [p(pth.summary), p(b('Total duration:'), ` ${pth.totalDuration}`)];

  if (pth.prerequisites.length > 0) {
    blocks.push(h2('Before you start'));
    blocks.push(bullets(pth.prerequisites));
  }

  blocks.push(h2('Milestones'));
  for (const m of pth.milestones) {
    blocks.push(h3(`${m.weekRange} · ${m.focus}`));
    if (m.activities.length > 0) {
      blocks.push(p(b('Activities:')));
      blocks.push(bullets(m.activities));
    }
    if (m.outcome) blocks.push(p(b('Outcome:'), ` ${m.outcome}`));
  }

  if (pth.portfolioProject) {
    blocks.push(h2('Portfolio project'));
    blocks.push(p(pth.portfolioProject));
  }
  if (pth.caveats.length > 0) {
    blocks.push(h2('Caveats'));
    blocks.push(bullets(pth.caveats));
  }
  if (srcs && srcs.length > 0) {
    blocks.push(h2('Sources'));
    blocks.push(sources(srcs));
  }

  blocks.push(
    disclaimer(
      'AI-generated. Treat specific course names as starting points, not final recommendations.'
    )
  );
  return { title: `Learning Path: ${pth.target}`, blocks };
}
