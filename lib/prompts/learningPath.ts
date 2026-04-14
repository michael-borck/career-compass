import type { GapAnalysis, LearningPath, StudentProfile, SourceRef } from '@/lib/session-store';
import { formatSourcesForFootnote } from '@/lib/search-prompt';

export type LearningPathInput = {
  jobAdvert?: string;
  jobTitle?: string;
  resume?: string;
  aboutYou?: string;
  distilledProfile?: StudentProfile;
  gapAnalysis?: GapAnalysis;
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

function formatGapsForPrompt(g: GapAnalysis): string {
  const lines = g.gaps.map((gap, i) =>
    `${i + 1}. [${gap.severity.toUpperCase()}] ${gap.title} — ${gap.why}`
  );
  return `Existing gap analysis for this target:\n${g.summary}\n\nGaps to close:\n${lines.join('\n')}`;
}

export function buildLearningPathPrompt(input: LearningPathInput): string {
  const { jobAdvert, jobTitle, resume, aboutYou, distilledProfile, gapAnalysis, sources } = input;

  const hasTarget = (jobAdvert && jobAdvert.trim()) || (jobTitle && jobTitle.trim());
  if (!hasTarget) {
    throw new Error('buildLearningPathPrompt: a target (jobAdvert or jobTitle) is required');
  }

  const targetSection = jobAdvert && jobAdvert.trim()
    ? `<target type="jobAdvert">\n${jobAdvert.trim()}\n</target>`
    : `<target type="jobTitle">\n${(jobTitle || '').trim()}\n</target>`;

  const sections: string[] = [];

  sections.push(
    `You are a career learning-path designer. Given a target role (and optionally a student profile and gap list), produce a structured week-by-week learning path. Milestones must be concrete and actionable. Be honest about AI limits — never fabricate specific course URLs, certification names, or pricing. Suggest the type of resource ("an intermediate SQL course on a major platform") not a specific one unless it is widely known (e.g., "Google Data Analytics Certificate"). Always include caveats.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no extra fields, no prose, no code fences):

{
  "target": string — the role name,
  "summary": string — 2-3 sentence overview of the path,
  "prerequisites": string[] — what the student should already have or confirm before starting,
  "milestones": Milestone[] — at least 1, ordered chronologically,
  "portfolioProject": string — one suggested capstone project that ties the milestones together,
  "totalDuration": string — e.g., "12 weeks" or "3-6 months part-time",
  "caveats": string[] — honest notes about AI limits, time assumptions, etc.
}

Each Milestone has the shape:
{
  "weekRange": string — e.g., "Weeks 1-2",
  "focus": string — short label for the milestone,
  "activities": string[] — concrete things to do,
  "outcome": string — what the student should be able to do by the end
}`
  );

  sections.push(targetSection);

  if (resume || aboutYou || distilledProfile) {
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
    sections.push(`<profile>\n${profileParts.join('\n\n')}\n</profile>`);
  }

  if (gapAnalysis) {
    sections.push(
      `<gapAnalysis>\n${formatGapsForPrompt(gapAnalysis)}\n</gapAnalysis>\n\nPrioritise the listed gaps in the earliest milestones.`
    );
  }

  if (sources && sources.length > 0) {
    sections.push(formatSourcesForFootnote(sources));
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

export function parseLearningPath(raw: string): LearningPath {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseLearningPath: not an object');
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('parseLearningPath: missing summary');
  }
  if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
    throw new Error('parseLearningPath: milestones must be a non-empty array');
  }
  if (typeof parsed.totalDuration !== 'string' || !parsed.totalDuration.trim()) {
    throw new Error('parseLearningPath: missing totalDuration');
  }

  const milestones = parsed.milestones.map((m: any, idx: number) => {
    if (typeof m.weekRange !== 'string' || !m.weekRange.trim()) {
      throw new Error(`parseLearningPath: milestone ${idx} missing weekRange`);
    }
    if (typeof m.focus !== 'string' || !m.focus.trim()) {
      throw new Error(`parseLearningPath: milestone ${idx} missing focus`);
    }
    return {
      weekRange: m.weekRange,
      focus: m.focus,
      activities: toStringArray(m.activities),
      outcome: typeof m.outcome === 'string' ? m.outcome : '',
    };
  });

  return {
    target: typeof parsed.target === 'string' && parsed.target.trim() ? parsed.target : 'this role',
    summary: parsed.summary,
    prerequisites: toStringArray(parsed.prerequisites),
    milestones,
    portfolioProject: typeof parsed.portfolioProject === 'string' ? parsed.portfolioProject : '',
    totalDuration: parsed.totalDuration,
    caveats: toStringArray(parsed.caveats),
  };
}
