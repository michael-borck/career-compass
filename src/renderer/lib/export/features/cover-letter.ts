// Cover Letter -> ExportDoc. The single content definition consumed by both
// the docx renderer (components/cover-letter/cover-letter-docx.ts) and the
// markdown renderer (lib/markdown-export.ts).

import type { CoverLetter } from '@/lib/session-store';
import { type ExportDoc, b, p, disclaimer } from '../doc';

export function coverLetterToExportDoc(l: CoverLetter): ExportDoc {
  const bodyParagraphs = l.body
    .split('\n\n')
    .filter(Boolean)
    .map((text) => p(text));

  return {
    title: 'Cover Letter',
    blocks: [
      p(b('Target:'), ` ${l.target}`),
      p(l.greeting),
      ...bodyParagraphs,
      p(l.closing),
      disclaimer('AI-generated draft. Edit before sending.'),
    ],
  };
}
