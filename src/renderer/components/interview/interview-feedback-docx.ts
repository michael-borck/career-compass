// Interview Feedback -> .docx via the shared ExportDoc renderer.
import { toDocx } from '@/lib/export/to-docx';
import { interviewFeedbackToExportDoc } from '@/lib/export/features/interview-feedback';
import type { InterviewFeedback, SourceRef } from '@/lib/session-store';

export function interviewFeedbackToDocx(
  f: InterviewFeedback,
  sources?: SourceRef[]
): Promise<Blob> {
  return toDocx(interviewFeedbackToExportDoc(f, sources));
}
