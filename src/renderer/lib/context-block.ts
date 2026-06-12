import type { StudentProfile } from './session-store';

function formatProfile(p: StudentProfile): string {
  const parts: string[] = [];
  if (p.background) parts.push(`Background: ${p.background}`);
  if (p.interests.length > 0) parts.push(`Interests: ${p.interests.join(', ')}`);
  if (p.skills.length > 0) parts.push(`Skills: ${p.skills.join(', ')}`);
  if (p.constraints.length > 0) parts.push(`Constraints: ${p.constraints.join(', ')}`);
  if (p.goals.length > 0) parts.push(`Goals: ${p.goals.join(', ')}`);
  return parts.join('\n');
}

export function buildContextBlock(
  resumeText?: string | null,
  freeText?: string,
  jobTitle?: string,
  jobAdvert?: string,
  distilledProfile?: StudentProfile | null
): string | null {
  const parts: string[] = [];
  if (resumeText && resumeText.trim()) {
    parts.push(`RESUME (full text, shared directly with you):\n${resumeText.trim()}`);
  }
  if (freeText && freeText.trim()) {
    parts.push(`BACKGROUND NOTES (shared directly with you):\n${freeText.trim()}`);
  }
  if (jobTitle && jobTitle.trim()) {
    parts.push(`JOB OF INTEREST: ${jobTitle.trim()}`);
  }
  if (jobAdvert && jobAdvert.trim()) {
    parts.push(`JOB ADVERT (full text, shared directly with you):\n${jobAdvert.trim()}`);
  }
  if (distilledProfile) {
    const profileText = formatProfile(distilledProfile);
    if (profileText) {
      parts.push(`STUDENT PROFILE (distilled from a previous chat):\n${profileText}`);
    }
  }
  if (parts.length === 0) return null;
  return `The student has shared the following information with you. The full text is included below — you CAN read it. When the student refers to "my resume", "the resume", "my attachment", "the job", "the advert", "what I uploaded", or similar phrases, they mean this content. Refer to it by its details, not as a separate file:\n\n${parts.join('\n\n')}`;
}
