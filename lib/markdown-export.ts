import type { GapAnalysis, LearningPath, InterviewFeedback, InterviewPhase, SourceRef, OdysseyLife, OdysseyLifeType, OdysseyDashboard, BoardReview, Comparison, ComparisonDimension, ElevatorPitch, CoverLetter, ResumeReview, ResumeReviewItem, CareerStory, CareerTheme, SkillsMapping, SkillFrameworkMapping, FrameworkLevel, IndustryExploration, ValuesCompass } from './session-store';
import { toMarkdown } from './export/to-markdown';
import { coverLetterToExportDoc } from './export/features/cover-letter';
import { pitchToExportDoc } from './export/features/pitch';
import { valuesCompassToExportDoc } from './export/features/values';
import { industryExplorationToExportDoc } from './export/features/industry';
import { resumeReviewToExportDoc } from './export/features/resume-review';
import { gapAnalysisToExportDoc } from './export/features/gap-analysis';
import { learningPathToExportDoc } from './export/features/learning-path';
import { interviewFeedbackToExportDoc } from './export/features/interview-feedback';
import { odysseyPlanToExportDoc } from './export/features/odyssey';
import { boardReviewToExportDoc } from './export/features/board';
import { careerStoryToExportDoc } from './export/features/career-story';
import { skillsMappingToExportDoc } from './export/features/skills-mapping';

export function gapAnalysisToMarkdown(g: GapAnalysis, sources?: SourceRef[]): string {
  return toMarkdown(gapAnalysisToExportDoc(g, sources));
}

export function learningPathToMarkdown(p: LearningPath, sources?: SourceRef[]): string {
  return toMarkdown(learningPathToExportDoc(p, sources));
}

export function interviewFeedbackToMarkdown(f: InterviewFeedback, sources?: SourceRef[]): string {
  return toMarkdown(interviewFeedbackToExportDoc(f, sources));
}

export function odysseyPlanToMarkdown(lives: Record<OdysseyLifeType, OdysseyLife>): string {
  return toMarkdown(odysseyPlanToExportDoc(lives));
}

export function boardReviewToMarkdown(r: BoardReview): string {
  return toMarkdown(boardReviewToExportDoc(r));
}

const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  typicalDay: 'Typical day',
  coreSkills: 'Core skills',
  trainingNeeded: 'Training needed',
  salaryRange: 'Salary range',
  workSetting: 'Work setting',
  whoItSuits: 'Who it suits',
  mainChallenge: 'Main challenge',
};

const DIMENSION_ORDER: ComparisonDimension[] = [
  'typicalDay',
  'coreSkills',
  'trainingNeeded',
  'salaryRange',
  'workSetting',
  'whoItSuits',
  'mainChallenge',
];

export function comparisonToMarkdown(c: Comparison): string {
  const lines: string[] = [];
  lines.push('# Career Comparison');
  lines.push('');

  if (c.mode === 'quick') {
    lines.push('**Mode:** Quick compare *(LLM-generated from job titles — vague, makes assumptions)*');
  } else {
    lines.push('**Mode:** Rich compare *(based on careers from your spider graph)*');
  }
  lines.push('');

  lines.push('## Roles compared');
  c.roles.forEach((role, i) => {
    lines.push(`${i + 1}. ${role.label}`);
  });
  lines.push('');

  lines.push('## Comparison');
  lines.push('');

  for (const dim of DIMENSION_ORDER) {
    lines.push(`### ${DIMENSION_LABELS[dim]}`);
    for (const role of c.roles) {
      lines.push(`- **${role.label}:** ${role.cells[dim]}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '*AI-generated comparison. Treat specific salary figures and training timelines as starting points, not guarantees.*'
  );

  return lines.join('\n');
}

export function pitchToMarkdown(p: ElevatorPitch): string {
  return toMarkdown(pitchToExportDoc(p));
}

export function coverLetterToMarkdown(l: CoverLetter): string {
  return toMarkdown(coverLetterToExportDoc(l));
}

export function resumeReviewToMarkdown(r: ResumeReview): string {
  return toMarkdown(resumeReviewToExportDoc(r));
}

export function careerStoryToMarkdown(s: CareerStory): string {
  return toMarkdown(careerStoryToExportDoc(s));
}

export function skillsMappingToMarkdown(m: SkillsMapping): string {
  return toMarkdown(skillsMappingToExportDoc(m));
}

export function industryExplorationToMarkdown(e: IndustryExploration): string {
  return toMarkdown(industryExplorationToExportDoc(e));
}

export function valuesCompassToMarkdown(compass: ValuesCompass): string {
  return toMarkdown(valuesCompassToExportDoc(compass));
}
