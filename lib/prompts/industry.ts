import type { IndustryExploration, IndustryRole, StudentProfile } from '@/lib/session-store';

export type IndustryInput = {
  industry: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  jobTitle?: string;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

export function buildIndustryPrompt(input: IndustryInput): string {
  const { industry, resume, aboutYou, distilledProfile, jobTitle } = input;

  if (!industry || !industry.trim()) {
    throw new Error('buildIndustryPrompt: an industry name is required');
  }

  const sections: string[] = [];

  sections.push(
    `You are a career exploration advisor. The student wants to learn about the "${industry.trim()}" industry. Give them a thorough, honest overview that helps them decide whether to explore further. Be practical and specific — name real sub-sectors, real job titles, real trends. Avoid generic advice.`
  );

  if (jobTitle && jobTitle.trim()) {
    sections.push(`The student is particularly interested in the role of "${jobTitle.trim()}" within this industry. Focus the exploration around that role where relevant.`);
  }

  sections.push(
    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "industry": string — the industry name as you'd label it,
  "overview": string — 2-3 paragraph overview of the industry: what it is, who works in it, how big it is, what makes it distinctive,
  "keyRoles": Role[] — 6-8 key roles in this industry, mix of entry-level and senior,
  "entryPoints": string[] — 3-5 practical ways a student could break into this industry,
  "growthAreas": string[] — 3-5 areas or sub-sectors that are expanding,
  "dayInTheLife": string — a paragraph describing what it actually feels like to work in this industry day-to-day,
  "challenges": string[] — 3-5 honest downsides or challenges of working in this industry,
  "skillsInDemand": string[] — 5-8 skills employers in this industry are looking for
}

Each Role has the shape:
{
  "title": string — job title,
  "description": string — 1-2 sentences about what this person does,
  "entryLevel": boolean — true if accessible to graduates or career changers
}`
  );

  const hasProfile = (resume && resume.trim()) || (aboutYou && aboutYou.trim()) || distilledProfile;
  if (hasProfile) {
    const profileParts: string[] = [];
    if (resume && resume.trim()) profileParts.push(`Resume:\n${resume.trim()}`);
    if (aboutYou && aboutYou.trim()) profileParts.push(`About me:\n${aboutYou.trim()}`);
    if (distilledProfile) profileParts.push(`Distilled profile:\n${formatProfile(distilledProfile)}`);
    sections.push(`<profile>\n${profileParts.join('\n\n')}\n</profile>\n\nPersonalise the entry points and skills assessment based on this student's background. Mention what they already have that's relevant.`);
  }

  sections.push('ONLY respond with JSON. No prose, no code fences.');
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

export function parseIndustryExploration(raw: string): IndustryExploration {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseIndustryExploration: not an object');
  }
  if (typeof parsed.overview !== 'string' || !parsed.overview.trim()) {
    throw new Error('parseIndustryExploration: missing overview');
  }
  if (!Array.isArray(parsed.keyRoles) || parsed.keyRoles.length === 0) {
    throw new Error('parseIndustryExploration: keyRoles must be a non-empty array');
  }

  const keyRoles: IndustryRole[] = parsed.keyRoles.map((r: any) => ({
    title: typeof r.title === 'string' ? r.title : 'Unknown role',
    description: typeof r.description === 'string' ? r.description : '',
    entryLevel: !!r.entryLevel,
  }));

  return {
    industry: typeof parsed.industry === 'string' && parsed.industry.trim() ? parsed.industry : 'this industry',
    overview: parsed.overview,
    keyRoles,
    entryPoints: toStringArray(parsed.entryPoints),
    growthAreas: toStringArray(parsed.growthAreas),
    dayInTheLife: typeof parsed.dayInTheLife === 'string' ? parsed.dayInTheLife : '',
    challenges: toStringArray(parsed.challenges),
    skillsInDemand: toStringArray(parsed.skillsInDemand),
  };
}
