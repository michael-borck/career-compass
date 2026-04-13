import type { GapAnalysis, LearningPath, InterviewFeedback, InterviewPhase } from './session-store';

export function gapAnalysisToMarkdown(g: GapAnalysis): string {
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
  lines.push('*AI-generated. Verify suggestions against your own situation.*');

  return lines.join('\n');
}

export function learningPathToMarkdown(p: LearningPath): string {
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

export function interviewFeedbackToMarkdown(f: InterviewFeedback): string {
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

  lines.push('*AI-generated feedback. Treat as one perspective, not a verdict.*');

  return lines.join('\n');
}
