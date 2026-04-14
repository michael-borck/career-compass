import type { StudentProfile, OdysseyLifeType } from '@/lib/session-store';

export type OdysseyElaborateInput = {
  type: OdysseyLifeType;
  label: string;
  seed: string;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type OdysseyElaboration = {
  headline: string;
  dayInTheLife: string;
  typicalWeek: string[];
  toolsAndSkills: string[];
  whoYouWorkWith: string;
  challenges: string[];
  questionsToExplore: string[];
};

const FRAMING: Record<OdysseyLifeType, string> = {
  current:
    "This is the student's current trajectory — the most natural extension of what they're already doing.",
  pivot:
    "This is a pivot — a different career that uses some of the same skills but heads in a new direction.",
  wildcard:
    "This is a wildcard — an unconventional life the student might pursue if money, image, and reputation didn't matter.",
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

function buildProfileSection(input: OdysseyElaborateInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) parts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) parts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(No profile provided. Keep the elaboration generic but still vivid.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildOdysseyElaboratePrompt(input: OdysseyElaborateInput): string {
  const sections = [
    `You are helping a student imagine a possible future life for their Odyssey Plan. ${FRAMING[input.type]} The student's seed is below. Elaborate it into a concrete, vivid 5-year-future vision.`,
    `Make the elaboration tangible and honest. Use specific details (not "works with computers" — "uses Python and Tableau to clean data from regional clinics"). Be honest about challenges — every life has downsides. The student needs to feel what this life would actually be like.`,
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "headline": string — 5-8 word pithy summary of the fleshed-out life,
  "dayInTheLife": string — vivid paragraph describing a typical day in 2030,
  "typicalWeek": string[] — 4-6 bullet points on the rhythm of the week,
  "toolsAndSkills": string[] — concrete tools, tech, skills used,
  "whoYouWorkWith": string — 1-2 sentences on the people and setting,
  "challenges": string[] — 3-5 honest trade-offs and difficulties,
  "questionsToExplore": string[] — 3-5 things the student would need to learn or decide
}`,
    `<lifeSeed>\nLabel: ${input.label}\nSeed: ${input.seed}\n</lifeSeed>`,
    buildProfileSection(input),
    'ONLY respond with JSON. No prose, no code fences.',
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

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export function parseOdysseyElaboration(raw: string): OdysseyElaboration {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseOdysseyElaboration: not an object');
  }
  if (typeof parsed.headline !== 'string' || !parsed.headline.trim()) {
    throw new Error('parseOdysseyElaboration: missing headline');
  }
  if (typeof parsed.dayInTheLife !== 'string' || !parsed.dayInTheLife.trim()) {
    throw new Error('parseOdysseyElaboration: missing dayInTheLife');
  }
  if (typeof parsed.whoYouWorkWith !== 'string' || !parsed.whoYouWorkWith.trim()) {
    throw new Error('parseOdysseyElaboration: missing whoYouWorkWith');
  }
  return {
    headline: parsed.headline.trim(),
    dayInTheLife: parsed.dayInTheLife.trim(),
    typicalWeek: toStringArray(parsed.typicalWeek),
    toolsAndSkills: toStringArray(parsed.toolsAndSkills),
    whoYouWorkWith: parsed.whoYouWorkWith.trim(),
    challenges: toStringArray(parsed.challenges),
    questionsToExplore: toStringArray(parsed.questionsToExplore),
  };
}
