import type { GapAnalysis, LearningPath, InterviewFeedback, SourceRef, OdysseyLife, OdysseyLifeType, BoardReview, Comparison, ElevatorPitch, CoverLetter, ResumeReview, CareerStory, SkillsMapping, IndustryExploration, ValuesCompass } from './session-store';
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
import { comparisonToExportDoc } from './export/features/compare';

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

export function comparisonToMarkdown(c: Comparison): string {
  return toMarkdown(comparisonToExportDoc(c));
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
