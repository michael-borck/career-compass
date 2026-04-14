import type { StudentProfile, OdysseyLifeType } from '@/lib/session-store';

export type SeedSuggestionInput = {
  type: OdysseyLifeType;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type SeedSuggestion = {
  label: string;
  description: string;
};

const FRAMING: Record<OdysseyLifeType, string> = {
  current:
    "Based on the student's profile below, what's the most likely natural progression of their current trajectory over the next five years? Propose a one-to-two sentence seed for their Odyssey Plan Life 1 (Current Path) — what they seem to be heading toward if they keep going as they are.",
  pivot:
    "If the student's current path disappeared tomorrow, what's an alternative career that would use their existing skills in a meaningfully different way? Propose a seed for Life 2 (The Pivot) — same student, different trajectory.",
  wildcard:
    "If money, image, and reputation didn't matter, what's a wildly different life this student might find meaningful based on their interests and values? Propose a seed for Life 3 (The Wildcard) — be bold, this is the fantasy slot.",
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildProfileSection(input: SeedSuggestionInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) parts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) parts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(The student has not provided profile information yet. Acknowledge this in the description.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildSeedSuggestionPrompt(input: SeedSuggestionInput): string {
  const sections = [
    FRAMING[input.type],
    buildProfileSection(input),
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "label": string (3-8 words, the name of this life),
  "description": string (1-2 sentences, written in first person from the student's point of view)
}

If the profile is thin, acknowledge that in the description ("Based on your limited profile, one possibility is...") rather than inventing details.

ONLY respond with JSON.`,
  ];
  return sections.join('\n\n');
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export function parseSeedSuggestion(raw: string): SeedSuggestion {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseSeedSuggestion: not an object');
  }
  if (typeof parsed.label !== 'string' || !parsed.label.trim()) {
    throw new Error('parseSeedSuggestion: missing label');
  }
  if (typeof parsed.description !== 'string' || !parsed.description.trim()) {
    throw new Error('parseSeedSuggestion: missing description');
  }
  return { label: parsed.label.trim(), description: parsed.description.trim() };
}
