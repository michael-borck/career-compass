// Learning Path -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { learningPathToExportDoc } from '@/lib/export/features/learning-path';
import type { LearningPath, SourceRef } from '@/lib/session-store';

export function learningPathToDocx(p: LearningPath, sources?: SourceRef[]): Promise<Blob> {
  return toDocx(learningPathToExportDoc(p, sources));
}
