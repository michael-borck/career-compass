// Interview Feedback -> ExportDoc. Takes optional grounding sources.
import type { InterviewFeedback, InterviewPhase, SourceRef } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, h3, p, bullets, note, sources, disclaimer } from '../doc';

const RATING_LABEL: Record<InterviewFeedback['overallRating'], string> = {
  developing: 'Developing',
  'on-track': 'On track',
  strong: 'Strong',
};
const PHASE_LABEL: Record<InterviewPhase, string> = {
  'warm-up': 'Warm-up',
  behavioural: 'Behavioural',
  'role-specific': 'Role-specific',
  'your-questions': 'Your questions',
  'wrap-up': 'Wrap-up',
};
const DIFFICULTY_LABEL: Record<'friendly' | 'standard' | 'tough', string> = {
  friendly: 'Friendly',
  standard: 'Standard',
  tough: 'Tough',
};

export function interviewFeedbackToExportDoc(
  f: InterviewFeedback,
  srcs?: SourceRef[]
): ExportDoc {
  const blocks: Block[] = [
    p(b('Difficulty:'), ` ${DIFFICULTY_LABEL[f.difficulty]}`),
    p(b('Overall rating:'), ` ${RATING_LABEL[f.overallRating]}`),
    p(f.summary),
  ];

  if (f.strengths.length > 0) {
    blocks.push(h2('What you did well'));
    blocks.push(bullets(f.strengths));
  }

  blocks.push(h2('What to work on'));
  f.improvements.forEach((imp, idx) => {
    blocks.push(h3(`${idx + 1}. ${imp.area}`));
    if (imp.why) blocks.push(p(b('Why it matters:'), ` ${imp.why}`));
    if (imp.example) {
      blocks.push(p(b('Example reframe of your answer:')));
      blocks.push(note(imp.example));
    }
  });

  if (f.perPhase.length > 0) {
    blocks.push(h2('By phase'));
    blocks.push(bullets(f.perPhase.map((ph) => [b(`${PHASE_LABEL[ph.phase]}:`), ` ${ph.note}`])));
  }

  if (f.nextSteps.length > 0) {
    blocks.push(h2('Next steps'));
    f.nextSteps.forEach((step, idx) => blocks.push(p(`${idx + 1}. ${step}`)));
  }

  if (srcs && srcs.length > 0) {
    blocks.push(h2('Sources consulted'));
    blocks.push(sources(srcs));
  }

  blocks.push(disclaimer('AI-generated feedback. Treat as one perspective, not a verdict.'));
  return { title: `Interview Feedback: ${f.target}`, blocks };
}
