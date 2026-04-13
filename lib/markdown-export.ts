import type { GapAnalysis, LearningPath } from './session-store';

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
