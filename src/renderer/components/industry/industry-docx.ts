// Industry Exploration -> .docx. Content defined in
// lib/export/features/industry.ts, rendered by the shared ExportDoc docx renderer.
import { toDocx } from '@/lib/export/to-docx';
import { industryExplorationToExportDoc } from '@/lib/export/features/industry';
import type { IndustryExploration } from '@/lib/session-store';

export function industryExplorationToDocx(e: IndustryExploration): Promise<Blob> {
  return toDocx(industryExplorationToExportDoc(e));
}
