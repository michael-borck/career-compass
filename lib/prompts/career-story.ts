import type { finalCareerInfo } from '@/lib/types';
import type {
  GapAnalysis,
  LearningPath,
  BoardReview,
  OdysseyLife,
  OdysseyLifeType,
  Comparison,
  ElevatorPitch,
  CoverLetter,
  ResumeReview,
  InterviewFeedback,
  StudentProfile,
  CareerStory,
  CareerTheme,
} from '@/lib/session-store';

export type CareerStoryInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile | null;
  careers?: finalCareerInfo[] | null;
  gapAnalysis?: GapAnalysis | null;
  learningPath?: LearningPath | null;
  boardReview?: BoardReview | null;
  odysseyLives?: Record<OdysseyLifeType, OdysseyLife> | null;
  comparison?: Comparison | null;
  elevatorPitch?: ElevatorPitch | null;
  coverLetter?: CoverLetter | null;
  resumeReview?: ResumeReview | null;
  interviewFeedback?: InterviewFeedback | null;
};

function buildSessionContext(input: CareerStoryInput): string {
  const sections: string[] = [];

  if (input.careers) {
    const careerSummaries = input.careers.map(
      (c) => `- ${c.jobTitle}: ${c.jobDescription}`
    );
    sections.push(`<careers>\n${careerSummaries.join('\n')}\n</careers>`);
  }

  if (input.gapAnalysis) {
    const g = input.gapAnalysis;
    const parts = [`Target: ${g.target}`, `Summary: ${g.summary}`];
    if (g.matches.length > 0) parts.push(`Matches: ${g.matches.join(', ')}`);
    if (g.gaps.length > 0) parts.push(`Gaps: ${g.gaps.map((gap) => gap.title).join(', ')}`);
    parts.push(`Timeline: ${g.realisticTimeline}`);
    sections.push(`<gapAnalysis>\n${parts.join('\n')}\n</gapAnalysis>`);
  }

  if (input.learningPath) {
    const l = input.learningPath;
    const parts = [`Target: ${l.target}`, `Summary: ${l.summary}`, `Duration: ${l.totalDuration}`];
    if (l.milestones.length > 0) {
      parts.push(`Milestones: ${l.milestones.map((m) => m.focus).join(', ')}`);
    }
    sections.push(`<learningPath>\n${parts.join('\n')}\n</learningPath>`);
  }

  if (input.boardReview) {
    const b = input.boardReview;
    const parts: string[] = [];
    for (const v of b.voices) {
      parts.push(`${v.name}: ${v.response}`);
    }
    if (b.synthesis.agreements.length > 0) {
      parts.push(`Agreements: ${b.synthesis.agreements.join('; ')}`);
    }
    if (b.synthesis.disagreements.length > 0) {
      parts.push(`Disagreements: ${b.synthesis.disagreements.join('; ')}`);
    }
    if (b.synthesis.topPriorities.length > 0) {
      parts.push(`Priorities: ${b.synthesis.topPriorities.join('; ')}`);
    }
    sections.push(`<boardReview>\n${parts.join('\n')}\n</boardReview>`);
  }

  if (input.odysseyLives) {
    const lives = input.odysseyLives;
    const parts: string[] = [];
    for (const type of ['current', 'pivot', 'wildcard'] as OdysseyLifeType[]) {
      const life = lives[type];
      if (life.label || life.headline) {
        parts.push(`${type}: ${life.label}${life.headline ? ` — ${life.headline}` : ''}`);
      }
    }
    if (parts.length > 0) {
      sections.push(`<odysseyLives>\n${parts.join('\n')}\n</odysseyLives>`);
    }
  }

  if (input.comparison) {
    const c = input.comparison;
    const roles = c.roles.map((r) => r.label).join(', ');
    sections.push(`<comparison>\nRoles compared: ${roles}\n</comparison>`);
  }

  if (input.elevatorPitch) {
    sections.push(`<elevatorPitch>\n${input.elevatorPitch.fullScript}\n</elevatorPitch>`);
  }

  if (input.coverLetter) {
    sections.push(`<coverLetter>\nTarget: ${input.coverLetter.target}\n${input.coverLetter.body}\n</coverLetter>`);
  }

  if (input.resumeReview) {
    const r = input.resumeReview;
    const parts = [`Overall: ${r.overallImpression}`];
    if (r.strengths.length > 0) parts.push(`Strengths: ${r.strengths.join(', ')}`);
    sections.push(`<resumeReview>\n${parts.join('\n')}\n</resumeReview>`);
  }

  if (input.interviewFeedback) {
    const f = input.interviewFeedback;
    const parts = [`Target: ${f.target}`, `Summary: ${f.summary}`, `Rating: ${f.overallRating}`];
    sections.push(`<interviewFeedback>\n${parts.join('\n')}\n</interviewFeedback>`);
  }

  if (sections.length === 0) return '';
  return `<sessionData>\n${sections.join('\n\n')}\n</sessionData>`;
}

export function buildCareerStoryPrompt(input: CareerStoryInput): string {
  const sections: string[] = [];

  sections.push(
    `You are a career narrative coach. The student has been exploring their career options using several tools. Your job is to read everything they have generated so far and distil it into a coherent career story — the themes that keep recurring and a short first-person narrative that ties them together.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "themes": [
    {
      "name": "short theme label (2-5 words)",
      "evidence": ["source: detail", "source: detail"],
      "reflectionQuestion": "one question the student should sit with"
    }
  ],
  "narrative": "A 2-4 paragraph first-person career narrative that weaves the themes together. Use line breaks between paragraphs."
}

Return 2-5 themes. Each theme should appear in at least two different sources when possible. The narrative should feel like the student wrote it — warm, honest, not corporate.`
  );

  // Profile section
  const profileParts: string[] = [];
  if (input.resume && input.resume.trim()) profileParts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) profileParts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) profileParts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) profileParts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) {
    const p = input.distilledProfile;
    profileParts.push(
      `Distilled profile:\nBackground: ${p.background}\nInterests: ${p.interests.join(', ')}\nSkills: ${p.skills.join(', ')}\nConstraints: ${p.constraints.join(', ')}\nGoals: ${p.goals.join(', ')}`
    );
  }

  if (profileParts.length > 0) {
    sections.push(`<profile>\n${profileParts.join('\n\n')}\n</profile>`);
  }

  // Session context from all outputs
  const sessionContext = buildSessionContext(input);
  if (sessionContext) {
    sections.push(sessionContext);
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

export function parseCareerStory(raw: string): CareerStory {
  const parsed = JSON.parse(cleanJSON(raw));

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseCareerStory: not an object');
  }

  if (!Array.isArray(parsed.themes) || parsed.themes.length === 0) {
    throw new Error('parseCareerStory: must have at least one theme');
  }

  const narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';
  if (!narrative) {
    throw new Error('parseCareerStory: narrative is required');
  }

  const themes: CareerTheme[] = parsed.themes.map((t: Record<string, unknown>) => {
    const name = typeof t.name === 'string' ? t.name.trim() : '';
    if (!name) {
      throw new Error('parseCareerStory: theme name is required');
    }
    const evidence = Array.isArray(t.evidence)
      ? t.evidence.filter((e: unknown): e is string => typeof e === 'string')
      : [];
    const reflectionQuestion = typeof t.reflectionQuestion === 'string' ? t.reflectionQuestion.trim() : '';
    return { name, evidence, reflectionQuestion };
  });

  return { themes, narrative };
}
