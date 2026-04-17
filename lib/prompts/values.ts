import type { ValuesCompass, WorkValue, StudentProfile } from '@/lib/session-store';

export type ValuesInput = {
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  valuesSeed?: string;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

export function buildValuesPrompt(input: ValuesInput): string {
  const { resume, aboutYou, distilledProfile, valuesSeed } = input;

  const sections: string[] = [];

  sections.push(
    `You are a career values coach. Help the student identify what matters most to them in their work life. Infer values from their profile, experience, and any seed text they provide. Be specific to this student — not generic. If the profile is thin, ask more from the seed text. If both are thin, still provide a thoughtful starting point they can refine.

Common work values to consider (but don't limit yourself to these):
Autonomy, Impact, Stability, Creativity, Teamwork, Recognition, Work-life balance, Learning, Leadership, Helping others, Financial security, Adventure, Flexibility, Prestige, Purpose, Variety, Structure, Independence.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "summary": string — 2-3 sentence narrative overview of the student's values profile,
  "values": WorkValue[] — 6-8 values ranked by importance (rank 1 = most important),
  "tensions": string[] — 2-3 places where the student's values might pull in different directions (e.g., "You value both stability and adventure — that tension is worth exploring")
}

Each WorkValue has the shape:
{
  "name": string — the value name,
  "rank": number — 1 = most important,
  "description": string — what this value means for this student specifically (not a dictionary definition),
  "evidence": string — why you think this matters to them, based on their profile or seed text,
  "reflectionQuestion": string — a question to help them think deeper about this value
}`
  );

  const hasProfile = (resume && resume.trim()) || (aboutYou && aboutYou.trim()) || distilledProfile;
  if (hasProfile) {
    const profileParts: string[] = [];
    if (resume && resume.trim()) profileParts.push(`Resume:\n${resume.trim()}`);
    if (aboutYou && aboutYou.trim()) profileParts.push(`About me:\n${aboutYou.trim()}`);
    if (distilledProfile) profileParts.push(`Distilled profile:\n${formatProfile(distilledProfile)}`);
    sections.push(`<profile>\n${profileParts.join('\n\n')}\n</profile>`);
  }

  if (valuesSeed && valuesSeed.trim()) {
    sections.push(`<valuesSeed>\nThe student wrote this about what matters to them:\n${valuesSeed.trim()}\n</valuesSeed>`);
  }

  if (!hasProfile && (!valuesSeed || !valuesSeed.trim())) {
    sections.push('The student provided no profile or seed text. Give a thoughtful general starting point based on common patterns for university students exploring careers. Note in the summary that this is a starting point and they should refine it.');
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

export function parseValuesCompass(raw: string): ValuesCompass {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseValuesCompass: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseValuesCompass: missing summary');
  }
  if (!Array.isArray(parsed.values) || parsed.values.length === 0) {
    throw new Error('parseValuesCompass: values must be a non-empty array');
  }

  const values: WorkValue[] = parsed.values.map((v: any, idx: number) => ({
    name: typeof v.name === 'string' ? v.name : `Value ${idx + 1}`,
    rank: typeof v.rank === 'number' ? v.rank : idx + 1,
    description: typeof v.description === 'string' ? v.description : '',
    evidence: typeof v.evidence === 'string' ? v.evidence : '',
    reflectionQuestion: typeof v.reflectionQuestion === 'string' ? v.reflectionQuestion : '',
  }));

  values.sort((a, b) => a.rank - b.rank);

  const tensions: string[] = Array.isArray(parsed.tensions)
    ? parsed.tensions.filter((t: unknown): t is string => typeof t === 'string')
    : [];

  return { summary: parsed.summary, values, tensions };
}
