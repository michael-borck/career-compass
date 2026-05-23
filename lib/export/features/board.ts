// Board of Advisors Review -> ExportDoc.
import type { BoardReview } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, disclaimer } from '../doc';

export function boardReviewToExportDoc(r: BoardReview): ExportDoc {
  const framing = r.framing.trim() || 'Open review — no specific focus';
  const blocks: Block[] = [
    p(b('Your framing:'), ` ${framing}`),
    p(b('Focus role:'), ` ${r.focusRole?.trim() || 'None'}`),
  ];

  for (const voice of r.voices) {
    blocks.push(h2(voice.name));
    for (const para of voice.response.split('\n\n').filter(Boolean)) blocks.push(p(para));
  }

  blocks.push(h2('Where the board landed'));
  if (r.synthesis.agreements.length > 0) {
    blocks.push(h3('Where they agreed'));
    blocks.push(bullets(r.synthesis.agreements));
  }
  if (r.synthesis.disagreements.length > 0) {
    blocks.push(h3('Where they pushed back on each other'));
    blocks.push(bullets(r.synthesis.disagreements));
  }
  if (r.synthesis.topPriorities.length > 0) {
    blocks.push(h3('What to work on'));
    r.synthesis.topPriorities.forEach((pr, i) => blocks.push(p(`${i + 1}. ${pr}`)));
  }

  blocks.push(
    disclaimer('Four AI-generated perspectives. Disagreement is part of the exercise.')
  );
  return { title: 'Board of Advisors Review', blocks };
}
