// Board of Advisors Review -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { boardReviewToExportDoc } from '@/lib/export/features/board';
import type { BoardReview } from '@/lib/session-store';

export function boardReviewToDocx(r: BoardReview): Promise<Blob> {
  return toDocx(boardReviewToExportDoc(r));
}
