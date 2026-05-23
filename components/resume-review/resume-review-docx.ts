// Resume Review -> .docx. Content defined in
// lib/export/features/resume-review.ts, rendered by the shared ExportDoc docx renderer.
import { toDocx } from '@/lib/export/to-docx';
import { resumeReviewToExportDoc } from '@/lib/export/features/resume-review';
import type { ResumeReview } from '@/lib/session-store';

export function resumeReviewToDocx(r: ResumeReview): Promise<Blob> {
  return toDocx(resumeReviewToExportDoc(r));
}
