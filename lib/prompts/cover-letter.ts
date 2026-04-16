import type { StudentProfile } from '@/lib/session-store';

export type CoverLetterInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type CoverLetterOutput = {
  greeting: string;
  body: string;
  closing: string;
};

function formatProfile(p: StudentProfile): string {
  return [`Background: ${p.background}`, `Interests: ${p.interests.join(', ')}`, `Skills: ${p.skills.join(', ')}`, `Constraints: ${p.constraints.join(', ')}`, `Goals: ${p.goals.join(', ')}`].join('\n');
}

function buildProfileSection(input: CoverLetterInput): string {
  const parts: string[] = [];
  if (input.resume?.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText?.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(No profile provided. Write a general cover letter.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildCoverLetterPrompt(input: CoverLetterInput): string {
  const sections: string[] = [];
  sections.push('Write a professional cover letter (300-500 words) for a student applying to a role. The letter should be formal but human. Written in first person.');
  sections.push('Structure:\n- Greeting: Professional salutation (use "Dear Hiring Manager," if no company name is known).\n- Body: Opening paragraph (why this role interests the student), 1-2 middle paragraphs (connecting experience and skills to the role requirements), closing paragraph (call to action, availability, enthusiasm). Separate paragraphs with double newlines.\n- Closing: Professional sign-off (e.g., "Sincerely," followed by a newline and the student\'s name or "[Your Name]" if unknown).');
  sections.push('Respond with JSON in EXACTLY this shape (no prose, no code fences):\n\n{\n  "greeting": string,\n  "body": string (multiple paragraphs separated by \\n\\n),\n  "closing": string\n}');
  if (input.jobTitle?.trim()) sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  if (input.jobAdvert?.trim()) sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
  sections.push(buildProfileSection(input));
  sections.push('ONLY respond with JSON. No prose, no code fences.');
  return sections.join('\n\n');
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  return cleaned.trim();
}

export function parseCoverLetter(raw: string): CoverLetterOutput {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parseCoverLetter: not an object');
  if (typeof parsed.greeting !== 'string' || !parsed.greeting.trim()) throw new Error('parseCoverLetter: missing greeting');
  if (typeof parsed.body !== 'string' || !parsed.body.trim()) throw new Error('parseCoverLetter: missing body');
  if (typeof parsed.closing !== 'string' || !parsed.closing.trim()) throw new Error('parseCoverLetter: missing closing');
  return { greeting: parsed.greeting.trim(), body: parsed.body.trim(), closing: parsed.closing.trim() };
}
