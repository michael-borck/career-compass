// Values Compass -> .docx. Content defined in lib/export/features/values.ts,
// rendered by the shared ExportDoc docx renderer.
import { toDocx } from '@/lib/export/to-docx';
import { valuesCompassToExportDoc } from '@/lib/export/features/values';
import type { ValuesCompass } from '@/lib/session-store';

export function valuesCompassToDocx(compass: ValuesCompass): Promise<Blob> {
  return toDocx(valuesCompassToExportDoc(compass));
}
