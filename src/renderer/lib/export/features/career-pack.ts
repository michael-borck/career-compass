// Career Pack -> ExportDoc. One document bundling every completed activity in
// the session — the tangible artifact of the whole journey (and, for student
// users, a submittable one). Each feature's content comes from its existing
// ExportDoc builder; per-feature disclaimers are dropped in favour of a
// single closing disclaimer.

import type {
  BoardReview,
  CareerStory,
  Comparison,
  CoverLetter,
  ElevatorPitch,
  GapAnalysis,
  IndustryExploration,
  InterviewFeedback,
  LearningPath,
  OdysseyLife,
  OdysseyLifeType,
  ResumeReview,
  SkillsMapping,
  SourceRef,
  ValuesCompass,
} from '@/lib/session-store';
import { type ExportDoc, type Block, h2, p, disclaimer } from '../doc';
import { careerStoryToExportDoc } from './career-story';
import { valuesCompassToExportDoc } from './values';
import { industryExplorationToExportDoc } from './industry';
import { comparisonToExportDoc } from './compare';
import { skillsMappingToExportDoc } from './skills-mapping';
import { gapAnalysisToExportDoc } from './gap-analysis';
import { learningPathToExportDoc } from './learning-path';
import { interviewFeedbackToExportDoc } from './interview-feedback';
import { boardReviewToExportDoc } from './board';
import { odysseyPlanToExportDoc } from './odyssey';
import { pitchToExportDoc } from './pitch';
import { coverLetterToExportDoc } from './cover-letter';
import { resumeReviewToExportDoc } from './resume-review';

export type CareerPackInput = {
  careerStory?: CareerStory | null;
  valuesCompass?: ValuesCompass | null;
  industryExploration?: IndustryExploration | null;
  comparison?: Comparison | null;
  skillsMapping?: SkillsMapping | null;
  gapAnalysis?: GapAnalysis | null;
  gapAnalysisSources?: SourceRef[] | null;
  learningPath?: LearningPath | null;
  learningPathSources?: SourceRef[] | null;
  interviewFeedback?: InterviewFeedback | null;
  interviewSources?: SourceRef[] | null;
  boardReview?: BoardReview | null;
  odysseyLives?: Record<OdysseyLifeType, OdysseyLife> | null;
  elevatorPitch?: ElevatorPitch | null;
  coverLetter?: CoverLetter | null;
  resumeReview?: ResumeReview | null;
};

// Sub-doc blocks minus their trailing disclaimers (the pack carries one).
function sectionBlocks(doc: ExportDoc): Block[] {
  return [h2(`■ ${doc.title}`), ...doc.blocks.filter((b) => b.kind !== 'disclaimer')];
}

// Reading order: the story opens, then Discover → Assess → Reflect →
// Materials, mirroring the app's pillar journey. Builders are lazy so that
// counting sections (for UI gating) never builds documents.
function sectionBuilders(input: CareerPackInput): Array<() => ExportDoc> {
  const builders: Array<() => ExportDoc> = [];
  const { careerStory, industryExploration, comparison, skillsMapping } = input;
  const { gapAnalysis, learningPath, interviewFeedback, valuesCompass, boardReview } = input;
  const { odysseyLives, elevatorPitch, coverLetter, resumeReview } = input;
  if (careerStory) builders.push(() => careerStoryToExportDoc(careerStory));
  if (industryExploration) builders.push(() => industryExplorationToExportDoc(industryExploration));
  if (comparison) builders.push(() => comparisonToExportDoc(comparison));
  if (skillsMapping) builders.push(() => skillsMappingToExportDoc(skillsMapping));
  if (gapAnalysis)
    builders.push(() => gapAnalysisToExportDoc(gapAnalysis, input.gapAnalysisSources ?? undefined));
  if (learningPath)
    builders.push(() =>
      learningPathToExportDoc(learningPath, input.learningPathSources ?? undefined)
    );
  if (interviewFeedback)
    builders.push(() =>
      interviewFeedbackToExportDoc(interviewFeedback, input.interviewSources ?? undefined)
    );
  if (valuesCompass) builders.push(() => valuesCompassToExportDoc(valuesCompass));
  if (boardReview) builders.push(() => boardReviewToExportDoc(boardReview));
  if (odysseyLives && Object.values(odysseyLives).some((l) => !!l.headline))
    builders.push(() => odysseyPlanToExportDoc(odysseyLives));
  if (elevatorPitch) builders.push(() => pitchToExportDoc(elevatorPitch));
  if (coverLetter) builders.push(() => coverLetterToExportDoc(coverLetter));
  if (resumeReview) builders.push(() => resumeReviewToExportDoc(resumeReview));
  return builders;
}

export function countPackSections(input: CareerPackInput): number {
  return sectionBuilders(input).length;
}

export function careerPackToExportDoc(input: CareerPackInput): ExportDoc | null {
  const sections = sectionBuilders(input).map((build) => build());
  if (sections.length === 0) return null;

  const blocks: Block[] = [
    p(
      `This pack collects everything produced in this Career Compass session — ${sections.length} ${
        sections.length === 1 ? 'section' : 'sections'
      }.`
    ),
  ];
  for (const doc of sections) blocks.push(...sectionBlocks(doc));
  blocks.push(
    disclaimer(
      'AI-generated content assembled from your Career Compass session. Treat suggestions, salary figures, and timelines as starting points — verify against your own situation.'
    )
  );
  return { title: 'Career Pack', blocks };
}
