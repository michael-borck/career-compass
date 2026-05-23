// Odyssey Plan -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { odysseyPlanToExportDoc } from '@/lib/export/features/odyssey';
import type { OdysseyLife, OdysseyLifeType } from '@/lib/session-store';

export function odysseyPlanToDocx(
  lives: Record<OdysseyLifeType, OdysseyLife>
): Promise<Blob> {
  return toDocx(odysseyPlanToExportDoc(lives));
}
