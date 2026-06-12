// Cover Letter -> .docx. Thin adapter: the content is defined once in
// lib/export/features/cover-letter.ts and rendered by the shared ExportDoc
// docx renderer.
import { toDocx } from '@/lib/export/to-docx';
import { coverLetterToExportDoc } from '@/lib/export/features/cover-letter';
import type { CoverLetter } from '@/lib/session-store';

export function coverLetterToDocx(letter: CoverLetter): Promise<Blob> {
  return toDocx(coverLetterToExportDoc(letter));
}
