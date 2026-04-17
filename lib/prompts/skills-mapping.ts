import type { StudentProfile, SkillsMapping, SkillFrameworkMapping, FrameworkLevel } from '@/lib/session-store';

export type SkillsMappingInput = {
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
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

export function buildSkillsMappingPrompt(input: SkillsMappingInput): string {
  const { resume, aboutYou, distilledProfile, jobTitle } = input;

  const hasProfile =
    (resume && resume.trim()) ||
    (aboutYou && aboutYou.trim()) ||
    distilledProfile;

  if (!hasProfile) {
    throw new Error('buildSkillsMappingPrompt: a profile (resume, aboutYou, or distilledProfile) is required');
  }

  const profileParts: string[] = [];
  if (resume && resume.trim()) {
    profileParts.push(`Resume:\n${resume.trim()}`);
  }
  if (aboutYou && aboutYou.trim()) {
    profileParts.push(`About me:\n${aboutYou.trim()}`);
  }
  if (distilledProfile) {
    profileParts.push(`Distilled profile:\n${formatProfile(distilledProfile)}`);
  }
  const profileSection = `<profile>\n${profileParts.join('\n\n')}\n</profile>`;

  const contextLine = jobTitle && jobTitle.trim()
    ? `The student is interested in: ${jobTitle.trim()}. Use this to weight which skills are most relevant.`
    : 'No specific target role — map all identifiable skills.';

  const sections: string[] = [
    `Read the student's profile below and identify their skills. Map each skill to recognised professional frameworks. Be practical: focus on skills that would actually go on a resume or come up in an interview. If a framework doesn't apply to a skill (e.g. SFIA doesn't cover nursing skills), set that framework to null.

${contextLine}

Four frameworks to map against:
- SFIA (Skills Framework for the Information Age): IT and digital skills, levels 1-7. Widely used in Australia and the UK.
- O*NET (Occupational Information Network): US occupational classification with broad coverage across all industries.
- ESCO (European Skills, Competences, Qualifications and Occupations): European standard, useful for international students.
- AQF (Australian Qualifications Framework): Maps to education and qualification levels (1-10), not individual skills. Use this to indicate the qualification level the student's demonstrated competency aligns with.

For each skill, also provide:
- A "professional phrase" — how to describe this skill on a resume or in an interview using business language
- A "next level" tip — one concrete thing they could do to move up one level in the most relevant framework`,

    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "summary": string — 2-3 sentence overview of the student's skills profile and how well the frameworks cover their skillset,
  "frameworkNotes": string — brief explanation of what each framework is and which ones are most relevant for this student (mention SFIA=AU/UK digital, O*NET=US broad, ESCO=EU, AQF=AU qualifications),
  "mappings": SkillMapping[] — one per identifiable skill, ordered by relevance
}

Each SkillMapping has the shape:
{
  "skill": string — the skill as the student described it,
  "sfia": { "name": string, "level": string, "description": string } | null,
  "onet": { "name": string, "level": string, "description": string } | null,
  "esco": { "name": string, "level": string, "description": string } | null,
  "aqf": { "name": string, "level": string, "description": string } | null,
  "professionalPhrase": string — how to say this on a resume,
  "nextLevel": string — one concrete action to level up
}

For framework objects: "name" is the framework's skill/category name, "level" is the level code or number, "description" is a short explanation of what that level means.`,

    profileSection,
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

function toStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function parseFrameworkLevel(v: unknown): FrameworkLevel {
  if (!v || typeof v !== 'object') return null;
  const obj = v as Record<string, unknown>;
  const name = toStringOrNull(obj.name);
  const level = toStringOrNull(obj.level);
  const description = toStringOrNull(obj.description);
  if (!name || !level) return null;
  return { name, level, description: description ?? '' };
}

export function parseSkillsMapping(raw: string): SkillsMapping {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseSkillsMapping: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseSkillsMapping: missing summary');
  }
  if (!Array.isArray(parsed.mappings) || parsed.mappings.length === 0) {
    throw new Error('parseSkillsMapping: mappings must be a non-empty array');
  }

  const mappings: SkillFrameworkMapping[] = parsed.mappings.map((m: any, idx: number) => {
    if (typeof m.skill !== 'string' || !m.skill.trim()) {
      throw new Error(`parseSkillsMapping: mapping ${idx} missing skill`);
    }
    return {
      skill: m.skill,
      sfia: parseFrameworkLevel(m.sfia),
      onet: parseFrameworkLevel(m.onet),
      esco: parseFrameworkLevel(m.esco),
      aqf: parseFrameworkLevel(m.aqf),
      professionalPhrase: typeof m.professionalPhrase === 'string' ? m.professionalPhrase : m.skill,
      nextLevel: typeof m.nextLevel === 'string' ? m.nextLevel : '',
    };
  });

  return {
    summary: parsed.summary,
    frameworkNotes: typeof parsed.frameworkNotes === 'string' ? parsed.frameworkNotes : '',
    mappings,
  };
}
