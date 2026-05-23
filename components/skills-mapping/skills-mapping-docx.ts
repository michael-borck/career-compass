// Skills Mapping -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { skillsMappingToExportDoc } from '@/lib/export/features/skills-mapping';
import type { SkillsMapping } from '@/lib/session-store';

export function skillsMappingToDocx(mapping: SkillsMapping): Promise<Blob> {
  return toDocx(skillsMappingToExportDoc(mapping));
}
