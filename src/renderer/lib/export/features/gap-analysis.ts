// Gap Analysis -> ExportDoc. Takes optional grounding sources (rendered as a
// numbered list — markdown links, docx plain).
import type { GapAnalysis, SourceRef } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, sources, disclaimer } from '../doc';

export function gapAnalysisToExportDoc(g: GapAnalysis, srcs?: SourceRef[]): ExportDoc {
  const blocks: Block[] = [p(g.summary)];

  if (g.matches.length > 0) {
    blocks.push(h2('What you already have'));
    blocks.push(bullets(g.matches));
  }

  blocks.push(h2('Gaps'));
  for (const gap of g.gaps) {
    blocks.push(h3(`[${gap.severity.toUpperCase()}] ${gap.title}`));
    if (gap.why) blocks.push(p(b('Why it matters:'), ` ${gap.why}`));
    if (gap.targetLevel) blocks.push(p(b('Target level:'), ` ${gap.targetLevel}`));
    if (gap.currentLevel) blocks.push(p(b('Current level:'), ` ${gap.currentLevel}`));
    if (gap.evidenceIdeas.length > 0) {
      blocks.push(p(b('How to demonstrate:')));
      blocks.push(bullets(gap.evidenceIdeas));
    }
  }

  blocks.push(h2('Rough timeline'));
  blocks.push(p(g.realisticTimeline));

  if (srcs && srcs.length > 0) {
    blocks.push(h2('Sources'));
    blocks.push(sources(srcs));
  }

  blocks.push(disclaimer('AI-generated. Verify suggestions against your own situation.'));

  return { title: `Gap Analysis: ${g.target}`, blocks };
}
