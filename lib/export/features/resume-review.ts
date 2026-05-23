// Resume Review -> ExportDoc.
import type { ResumeReview } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, disclaimer } from '../doc';

export function resumeReviewToExportDoc(r: ResumeReview): ExportDoc {
  const blocks: Block[] = [p(b('Target:'), ` ${r.target ?? 'General review'}`)];

  blocks.push(h2('Overall impression'));
  for (const para of r.overallImpression.split('\n\n').filter(Boolean)) blocks.push(p(para));

  if (r.strengths.length > 0) {
    blocks.push(h2("What's working"));
    blocks.push(bullets(r.strengths));
  }

  blocks.push(h2('Suggested improvements'));
  r.improvements.forEach((imp, idx) => {
    blocks.push(h3(`${idx + 1}. ${imp.section}`));
    blocks.push(p(b('Suggestion:'), ` ${imp.suggestion}`));
    if (imp.why) blocks.push(p(b('Why:'), ` ${imp.why}`));
    if (imp.example) blocks.push(p(b('Example:'), ` "${imp.example}"`));
  });

  if (r.keywordsToAdd.length > 0) {
    blocks.push(h2('Keywords to add'));
    blocks.push(bullets(r.keywordsToAdd));
  }
  if (r.structuralNotes.length > 0) {
    blocks.push(h2('Structural notes'));
    blocks.push(bullets(r.structuralNotes));
  }

  blocks.push(
    disclaimer('AI-generated feedback. Use as a starting point, not a final verdict.')
  );

  return { title: 'Resume Review', blocks };
}
