import type {
  StudentProfile,
  BoardAdvisorVoice,
  BoardAdvisorRole,
  BoardSynthesis,
} from '@/lib/session-store';

export type BoardInput = {
  framing: string;
  focusRole: string | null;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type ParsedBoard = {
  voices: BoardAdvisorVoice[];
  synthesis: BoardSynthesis;
};

const ROLE_ORDER: BoardAdvisorRole[] = ['recruiter', 'hr', 'manager', 'mentor'];

const ROLE_NAMES: Record<BoardAdvisorRole, string> = {
  recruiter: 'The Recruiter',
  hr: 'The HR Partner',
  manager: 'The Hiring Manager',
  mentor: 'The Mentor',
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

function buildProfileSection(input: BoardInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) parts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) parts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(No profile material provided.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildBoardPrompt(input: BoardInput): string {
  const sections: string[] = [];

  sections.push(
    `You are running a Board of Advisors review for a student. Four advisors each read the student's profile and share what they notice. The advisors have different personalities and will not always agree — that's the point.`
  );

  sections.push(
    `Advisor 1 — The Recruiter. Market-facing. Thinks about how this profile would land in an applicant tracking system and a recruiter's 30-second scan. Cares about keywords, positioning, resume format, and market signal. Direct and pragmatic.

Advisor 2 — The HR Partner. Thinks about culture fit, soft-skill signals, red flags, and what references would likely say. Reads between the lines. Thoughtful, careful tone.

Advisor 3 — The Hiring Manager. Thinks about whether they'd bet their team on this person. Cares about evidence of impact, problem-solving stories, and what they'd probe in an interview. Skeptical but fair.

Advisor 4 — The Mentor. A warm but honest career coach. Counterbalances the first three without sugar-coating. Names strengths the others might miss and suggests low-risk experiments. Encouraging but never dishonest.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "voices": [
    { "role": "recruiter", "name": "The Recruiter", "response": string (2-4 sentences in character) },
    { "role": "hr", "name": "The HR Partner", "response": string (2-4 sentences in character) },
    { "role": "manager", "name": "The Hiring Manager", "response": string (2-4 sentences in character) },
    { "role": "mentor", "name": "The Mentor", "response": string (2-4 sentences in character) }
  ],
  "synthesis": {
    "agreements": string[] (2-4 points where the board converged),
    "disagreements": string[] (1-3 points where advisors pushed back on each other — be specific about which advisor said what, e.g. "The Recruiter thought X, but The Mentor argued Y."),
    "topPriorities": string[] (2-3 things to work on, ordered most important first)
  }
}

Make the disagreements real. If the recruiter sees a weakness the mentor sees as a strength, name both sides. Students learn more from watching credible voices disagree than from a unified verdict.`
  );

  if (input.framing && input.framing.trim()) {
    sections.push(`<framing>\n${input.framing.trim()}\n</framing>`);
  }

  if (input.focusRole && input.focusRole.trim()) {
    sections.push(`<focusRole>\n${input.focusRole.trim()}\n</focusRole>`);
  }

  sections.push(buildProfileSection(input));

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

export function parseBoardReview(raw: string): ParsedBoard {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseBoardReview: not an object');
  }
  if (!Array.isArray(parsed.voices)) {
    throw new Error('parseBoardReview: voices must be an array');
  }

  const byRole = new Map<BoardAdvisorRole, BoardAdvisorVoice>();
  for (const rawVoice of parsed.voices) {
    if (!rawVoice || typeof rawVoice !== 'object') continue;
    const role = rawVoice.role as BoardAdvisorRole;
    if (!ROLE_ORDER.includes(role)) continue;
    const response = typeof rawVoice.response === 'string' ? rawVoice.response.trim() : '';
    if (!response) {
      throw new Error(`parseBoardReview: voice ${role} has empty response`);
    }
    byRole.set(role, {
      role,
      name:
        typeof rawVoice.name === 'string' && rawVoice.name.trim()
          ? rawVoice.name.trim()
          : ROLE_NAMES[role],
      response,
    });
  }

  for (const role of ROLE_ORDER) {
    if (!byRole.has(role)) {
      throw new Error(`parseBoardReview: missing role ${role}`);
    }
  }

  const voices = ROLE_ORDER.map((role) => byRole.get(role)!);

  const synthRaw = (parsed.synthesis ?? {}) as Record<string, unknown>;
  const synthesis: BoardSynthesis = {
    agreements: toStringArray(synthRaw.agreements),
    disagreements: toStringArray(synthRaw.disagreements),
    topPriorities: toStringArray(synthRaw.topPriorities),
  };

  if (
    synthesis.agreements.length === 0 &&
    synthesis.disagreements.length === 0 &&
    synthesis.topPriorities.length === 0
  ) {
    throw new Error('parseBoardReview: synthesis must have at least one non-empty list');
  }

  return { voices, synthesis };
}
