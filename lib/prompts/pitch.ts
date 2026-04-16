import type { StudentProfile } from '@/lib/session-store';

export type PitchInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type PitchOutput = {
  hook: string;
  body: string;
  close: string;
  fullScript: string;
};

function formatProfile(p: StudentProfile): string {
  return [`Background: ${p.background}`, `Interests: ${p.interests.join(', ')}`, `Skills: ${p.skills.join(', ')}`, `Constraints: ${p.constraints.join(', ')}`, `Goals: ${p.goals.join(', ')}`].join('\n');
}

function buildProfileSection(input: PitchInput): string {
  const parts: string[] = [];
  if (input.resume?.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText?.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(Minimal profile provided. Keep the pitch general.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildPitchPrompt(input: PitchInput): string {
  const sections: string[] = [];
  sections.push('Write a 30-60 second elevator pitch (about 150-200 words) for a student. The pitch should be conversational, written in first person, and suitable for a networking event or career fair.');
  sections.push('Structure the pitch in three parts:\n- Hook: An opening line that grabs attention and sets the scene (1 sentence).\n- Body: 2-3 key strengths or experiences that connect the student to their goals or target role (3-5 sentences).\n- Close: What the student is looking for and a call to action (1-2 sentences).\n\nAlso produce a fullScript that joins hook, body, and close into one naturally flowing spoken paragraph.');
  sections.push('Respond with JSON in EXACTLY this shape (no prose, no code fences):\n\n{\n  "hook": string,\n  "body": string,\n  "close": string,\n  "fullScript": string\n}');
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

export function parsePitch(raw: string): PitchOutput {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parsePitch: not an object');
  if (typeof parsed.hook !== 'string' || !parsed.hook.trim()) throw new Error('parsePitch: missing hook');
  if (typeof parsed.body !== 'string' || !parsed.body.trim()) throw new Error('parsePitch: missing body');
  if (typeof parsed.close !== 'string' || !parsed.close.trim()) throw new Error('parsePitch: missing close');
  if (typeof parsed.fullScript !== 'string' || !parsed.fullScript.trim()) throw new Error('parsePitch: missing fullScript');
  return { hook: parsed.hook.trim(), body: parsed.body.trim(), close: parsed.close.trim(), fullScript: parsed.fullScript.trim() };
}
