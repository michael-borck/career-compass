// Elevator Pitch -> .docx. Content defined in lib/export/features/pitch.ts,
// rendered by the shared ExportDoc docx renderer.
import { toDocx } from '@/lib/export/to-docx';
import { pitchToExportDoc } from '@/lib/export/features/pitch';
import type { ElevatorPitch } from '@/lib/session-store';

export function pitchToDocx(p: ElevatorPitch): Promise<Blob> {
  return toDocx(pitchToExportDoc(p));
}
