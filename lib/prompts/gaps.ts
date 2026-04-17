import type { GapAnalysis, StudentProfile, SourceRef, SkillsMapping } from '@/lib/session-store';
import { formatSourcesForInlineCite } from '@/lib/search-prompt';

export type GapAnalysisInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  skillsMapping?: SkillsMapping;
  sources?: SourceRef[];
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

function formatSkillsMapping(m: SkillsMapping): string {
  const lines = m.mappings.map((s) => {
    const parts = [`${s.skill} → "${s.professionalPhrase}"`];
    if (s.sfia) parts.push(`SFIA: ${s.sfia.name} Level ${s.sfia.level}`);
    if (s.onet) parts.push(`O*NET: ${s.onet.name} Level ${s.onet.level}`);
    return parts.join(' | ');
  });
  return `Skills framework mapping (student completed this earlier):\n${lines.join('\n')}`;
}

export function buildGapAnalysisPrompt(input: GapAnalysisInput): string {
  const { jobAdvert, jobTitle, resume, aboutYou, distilledProfile, skillsMapping, sources } = input;

  const hasTarget = (jobAdvert && jobAdvert.trim()) || (jobTitle && jobTitle.trim());
  const hasProfile =
    (resume && resume.trim()) ||
    (aboutYou && aboutYou.trim()) ||
    distilledProfile;

  if (!hasTarget) {
    throw new Error('buildGapAnalysisPrompt: a target (jobAdvert or jobTitle) is required');
  }
  if (!hasProfile) {
    throw new Error('buildGapAnalysisPrompt: a profile (resume, aboutYou, or distilledProfile) is required');
  }

  const targetSection = jobAdvert && jobAdvert.trim()
    ? `<target type="jobAdvert">\n${jobAdvert.trim()}\n</target>`
    : `<target type="jobTitle">\n${(jobTitle || '').trim()}\n</target>`;

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

  const sections: string[] = [
    `Read the target role and the student's profile below. Identify specific gaps the student needs to close to be a strong candidate. Be honest but encouraging — always call out what the student already has. Never fabricate specific course names, URLs, certifications, or pricing. Describe the type of evidence that would close each gap, not named products. If the profile is thin, say so in the summary.`,
    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "target": string — short label for the role being analysed (e.g., "Data Analyst" or a 5-10 word summary of the advert),
  "summary": string — 2-3 sentence plain-English overview of how the student is positioned for this role,
  "matches": string[] — what the student already has that fits this role (morale boost — always include something if possible),
  "gaps": Gap[] — at least 1, ordered by severity (critical first),
  "realisticTimeline": string — e.g., "3-6 months with focused effort"
}

Each Gap has the shape:
{
  "title": string,
  "category": "technical" | "experience" | "qualification" | "soft" | "domain",
  "severity": "critical" | "important" | "nice-to-have",
  "why": string — 1-2 sentences explaining why this matters for this target,
  "targetLevel": string — what the role expects,
  "currentLevel": string | null — what the student appears to have now (null if unclear),
  "evidenceIdeas": string[] — concrete (but not branded) ways to demonstrate this skill
}`,
    targetSection,
    profileSection,
  ];

  if (skillsMapping) {
    sections.push(`<skillsMapping>\n${formatSkillsMapping(skillsMapping)}\n</skillsMapping>\n\nUse the student's existing framework levels when describing currentLevel and targetLevel in gaps. Reference SFIA or O*NET levels where relevant.`);
  }

  if (sources && sources.length > 0) {
    sections.push(formatSourcesForInlineCite(sources));
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

const VALID_CATEGORIES = new Set(['technical', 'experience', 'qualification', 'soft', 'domain']);
const VALID_SEVERITIES = new Set(['critical', 'important', 'nice-to-have']);

export function parseGapAnalysis(raw: string): GapAnalysis {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseGapAnalysis: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseGapAnalysis: missing summary');
  }
  if (!Array.isArray(parsed.gaps) || parsed.gaps.length === 0) {
    throw new Error('parseGapAnalysis: gaps must be a non-empty array');
  }

  const gaps = parsed.gaps.map((g: any, idx: number) => {
    if (typeof g.title !== 'string' || !g.title.trim()) {
      throw new Error(`parseGapAnalysis: gap ${idx} missing title`);
    }
    const category = VALID_CATEGORIES.has(g.category) ? g.category : 'technical';
    const severity = VALID_SEVERITIES.has(g.severity) ? g.severity : 'important';
    return {
      title: g.title,
      category,
      severity,
      why: typeof g.why === 'string' ? g.why : '',
      targetLevel: typeof g.targetLevel === 'string' ? g.targetLevel : '',
      currentLevel: typeof g.currentLevel === 'string' ? g.currentLevel : null,
      evidenceIdeas: toStringArray(g.evidenceIdeas),
    };
  });

  return {
    target: typeof parsed.target === 'string' && parsed.target.trim() ? parsed.target : 'this role',
    summary: parsed.summary,
    matches: toStringArray(parsed.matches),
    gaps,
    realisticTimeline: typeof parsed.realisticTimeline === 'string'
      ? parsed.realisticTimeline
      : 'Hard to say — depends on your situation',
  };
}
