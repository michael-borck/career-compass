// Career Comparison -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { comparisonToExportDoc } from '@/lib/export/features/compare';
import type { Comparison } from '@/lib/session-store';

export function comparisonToDocx(c: Comparison): Promise<Blob> {
  return toDocx(comparisonToExportDoc(c));
}
