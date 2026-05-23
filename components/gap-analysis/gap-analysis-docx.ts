// Gap Analysis -> .docx. Content defined in
// lib/export/features/gap-analysis.ts, rendered by the shared ExportDoc docx renderer.
import { toDocx } from '@/lib/export/to-docx';
import { gapAnalysisToExportDoc } from '@/lib/export/features/gap-analysis';
import type { GapAnalysis, SourceRef } from '@/lib/session-store';

export function gapAnalysisToDocx(g: GapAnalysis, sources?: SourceRef[]): Promise<Blob> {
  return toDocx(gapAnalysisToExportDoc(g, sources));
}
