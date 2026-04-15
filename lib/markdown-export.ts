import type { GapAnalysis, LearningPath, InterviewFeedback, InterviewPhase, SourceRef, OdysseyLife, OdysseyLifeType, OdysseyDashboard, BoardReview } from './session-store';

export function gapAnalysisToMarkdown(g: GapAnalysis, sources?: SourceRef[]): string {
  const lines: string[] = [];

  lines.push(`# Gap Analysis: ${g.target}`);
  lines.push('');
  lines.push(g.summary);
  lines.push('');

  if (g.matches.length > 0) {
    lines.push('## What you already have');
    for (const m of g.matches) {
      lines.push(`- ${m}`);
    }
    lines.push('');
  }

  lines.push('## Gaps');
  lines.push('');
  for (const gap of g.gaps) {
    lines.push(`### [${gap.severity.toUpperCase()}] ${gap.title}`);
    if (gap.why) lines.push(`**Why it matters:** ${gap.why}`);
    if (gap.targetLevel) lines.push(`**Target level:** ${gap.targetLevel}`);
    if (gap.currentLevel) lines.push(`**Current level:** ${gap.currentLevel}`);
    if (gap.evidenceIdeas.length > 0) {
      lines.push('**How to demonstrate:**');
      for (const e of gap.evidenceIdeas) {
        lines.push(`- ${e}`);
      }
    }
    lines.push('');
  }

  lines.push('## Rough timeline');
  lines.push(g.realisticTimeline);
  lines.push('');

  if (sources && sources.length > 0) {
    lines.push('## Sources');
    sources.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url}) — ${s.domain}`);
    });
    lines.push('');
  }

  lines.push('*AI-generated. Verify suggestions against your own situation.*');

  return lines.join('\n');
}

export function learningPathToMarkdown(p: LearningPath, sources?: SourceRef[]): string {
  const lines: string[] = [];

  lines.push(`# Learning Path: ${p.target}`);
  lines.push('');
  lines.push(p.summary);
  lines.push('');
  lines.push(`**Total duration:** ${p.totalDuration}`);
  lines.push('');

  if (p.prerequisites.length > 0) {
    lines.push('## Before you start');
    for (const pre of p.prerequisites) {
      lines.push(`- ${pre}`);
    }
    lines.push('');
  }

  lines.push('## Milestones');
  lines.push('');
  for (const m of p.milestones) {
    lines.push(`### ${m.weekRange} · ${m.focus}`);
    if (m.activities.length > 0) {
      lines.push('**Activities:**');
      for (const a of m.activities) {
        lines.push(`- ${a}`);
      }
    }
    if (m.outcome) {
      lines.push('');
      lines.push(`**Outcome:** ${m.outcome}`);
    }
    lines.push('');
  }

  if (p.portfolioProject) {
    lines.push('## Portfolio project');
    lines.push(p.portfolioProject);
    lines.push('');
  }

  if (p.caveats.length > 0) {
    lines.push('## Caveats');
    for (const c of p.caveats) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  if (sources && sources.length > 0) {
    lines.push('## Sources');
    sources.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url}) — ${s.domain}`);
    });
    lines.push('');
  }

  lines.push('*AI-generated. Treat specific course names as starting points, not final recommendations.*');

  return lines.join('\n');
}

const RATING_LABEL: Record<InterviewFeedback['overallRating'], string> = {
  'developing': 'Developing',
  'on-track': 'On track',
  'strong': 'Strong',
};

const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  'behavioural': 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};

const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

export function interviewFeedbackToMarkdown(f: InterviewFeedback, sources?: SourceRef[]): string {
  const lines: string[] = [];

  lines.push(`# Interview Feedback: ${f.target}`);
  lines.push('');
  lines.push(`**Difficulty:** ${DIFFICULTY_LABEL[f.difficulty]}`);
  lines.push(`**Overall rating:** ${RATING_LABEL[f.overallRating]}`);
  lines.push('');
  lines.push(f.summary);
  lines.push('');

  if (f.strengths.length > 0) {
    lines.push('## What you did well');
    for (const s of f.strengths) {
      lines.push(`- ${s}`);
    }
    lines.push('');
  }

  lines.push('## What to work on');
  lines.push('');
  f.improvements.forEach((imp, idx) => {
    lines.push(`### ${idx + 1}. ${imp.area}`);
    if (imp.why) lines.push(`**Why it matters:** ${imp.why}`);
    if (imp.example) {
      lines.push(`**Example reframe of your answer:**`);
      lines.push(`> ${imp.example}`);
    }
    lines.push('');
  });

  if (f.perPhase.length > 0) {
    lines.push('## By phase');
    for (const p of f.perPhase) {
      lines.push(`- **${PHASE_LABEL[p.phase]}:** ${p.note}`);
    }
    lines.push('');
  }

  if (f.nextSteps.length > 0) {
    lines.push('## Next steps');
    f.nextSteps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    lines.push('');
  }

  if (sources && sources.length > 0) {
    lines.push('## Sources consulted');
    sources.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url}) — ${s.domain}`);
    });
    lines.push('');
  }

  lines.push('*AI-generated feedback. Treat as one perspective, not a verdict.*');

  return lines.join('\n');
}

const LIFE_LABELS: Record<OdysseyLifeType, { index: number; fallback: string }> = {
  current: { index: 1, fallback: 'Current Path' },
  pivot: { index: 2, fallback: 'The Pivot' },
  wildcard: { index: 3, fallback: 'The Wildcard' },
};

const DASHBOARD_ROWS: { field: keyof OdysseyDashboard; label: string; question: string }[] = [
  { field: 'resources', label: 'Resources', question: 'do I have what I\'d need to make this happen?' },
  { field: 'likability', label: 'Likability', question: 'do I actually like the sound of this?' },
  { field: 'confidence', label: 'Confidence', question: 'am I confident I could make it work?' },
  { field: 'coherence', label: 'Coherence', question: 'does it fit who I\'m becoming?' },
];

function renderDashboard(d: OdysseyDashboard): string[] {
  const lines = ['### How does this feel?'];
  for (const row of DASHBOARD_ROWS) {
    const value = d[row.field];
    if (value === null) {
      lines.push(`- **${row.label}:** — not yet rated`);
    } else {
      lines.push(`- **${row.label}:** ${value}/5 — ${row.question}`);
    }
  }
  return lines;
}

function renderLife(life: OdysseyLife): string[] {
  const { index, fallback } = LIFE_LABELS[life.type];
  const label = life.label.trim() || fallback;
  const lines: string[] = [];
  lines.push(`## Life ${index} — ${fallback}: ${label}`);
  lines.push('');

  if (!life.headline && !life.dayInTheLife) {
    if (life.seed.trim()) {
      lines.push(`**Seed:** ${life.seed.trim()}`);
      lines.push('');
    }
    lines.push('*(This life has not been elaborated yet.)*');
    lines.push('');
    lines.push(...renderDashboard(life.dashboard));
    lines.push('');
    return lines;
  }

  if (life.headline) {
    lines.push(`**${life.headline}**`);
    lines.push('');
  }
  if (life.dayInTheLife) {
    lines.push('### A day in 2030');
    lines.push(life.dayInTheLife);
    lines.push('');
  }
  if (life.typicalWeek.length > 0) {
    lines.push('### Typical week');
    for (const w of life.typicalWeek) lines.push(`- ${w}`);
    lines.push('');
  }
  if (life.toolsAndSkills.length > 0) {
    lines.push('### Tools & skills');
    for (const t of life.toolsAndSkills) lines.push(`- ${t}`);
    lines.push('');
  }
  if (life.whoYouWorkWith) {
    lines.push('### Who you work with');
    lines.push(life.whoYouWorkWith);
    lines.push('');
  }
  if (life.challenges.length > 0) {
    lines.push('### Challenges');
    for (const c of life.challenges) lines.push(`- ${c}`);
    lines.push('');
  }
  if (life.questionsToExplore.length > 0) {
    lines.push('### Questions to explore');
    for (const q of life.questionsToExplore) lines.push(`- ${q}`);
    lines.push('');
  }
  lines.push(...renderDashboard(life.dashboard));
  lines.push('');
  return lines;
}

export function odysseyPlanToMarkdown(lives: Record<OdysseyLifeType, OdysseyLife>): string {
  const lines: string[] = [];
  lines.push('# Odyssey Plan: Three Alternative Lives');
  lines.push('');

  const order: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];
  order.forEach((type, idx) => {
    lines.push(...renderLife(lives[type]));
    if (idx < order.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });

  lines.push('---');
  lines.push('');
  lines.push('*AI-generated elaboration. Dashboard ratings are your own reflection.*');
  return lines.join('\n');
}

export function boardReviewToMarkdown(r: BoardReview): string {
  const lines: string[] = [];
  lines.push('# Board of Advisors Review');
  lines.push('');
  const framingLine = r.framing.trim() || 'Open review — no specific focus';
  lines.push(`**Your framing:** ${framingLine}`);
  lines.push(`**Focus role:** ${r.focusRole?.trim() || 'None'}`);
  lines.push('');

  for (const voice of r.voices) {
    lines.push(`## ${voice.name}`);
    lines.push(voice.response);
    lines.push('');
  }

  lines.push('## Where the board landed');
  lines.push('');

  if (r.synthesis.agreements.length > 0) {
    lines.push('### Where they agreed');
    for (const a of r.synthesis.agreements) lines.push(`- ${a}`);
    lines.push('');
  }

  if (r.synthesis.disagreements.length > 0) {
    lines.push('### Where they pushed back on each other');
    for (const d of r.synthesis.disagreements) lines.push(`- ${d}`);
    lines.push('');
  }

  if (r.synthesis.topPriorities.length > 0) {
    lines.push('### What to work on');
    r.synthesis.topPriorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*Four AI-generated perspectives. Disagreement is part of the exercise.*');
  return lines.join('\n');
}
