// Career Story -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { careerStoryToExportDoc } from '@/lib/export/features/career-story';
import type { CareerStory } from '@/lib/session-store';

export function careerStoryToDocx(story: CareerStory): Promise<Blob> {
  return toDocx(careerStoryToExportDoc(story));
}
