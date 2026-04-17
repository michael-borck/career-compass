import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import type { InterviewFeedback, InterviewPhase, SourceRef } from '@/lib/session-store';

const FONT = 'Calibri';

type TextOpts = { bold?: boolean; italics?: boolean; size?: number; color?: string };

function text(t: string, opts?: TextOpts) {
  return new TextRun({ text: t, size: 24, font: FONT, ...opts });
}

function heading(level: typeof HeadingLevel[keyof typeof HeadingLevel], t: string, size: number) {
  return new Paragraph({
    children: [text(t, { bold: true, size })],
    heading: level,
    spacing: { before: 300, after: 200 },
  });
}

function bullet(t: string) {
  return new Paragraph({
    children: [text(`  •  ${t}`)],
    spacing: { after: 50 },
  });
}

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

export async function interviewFeedbackToDocx(f: InterviewFeedback, sources?: SourceRef[]): Promise<Blob> {
  const children: Paragraph[] = [];

  children.push(heading(HeadingLevel.HEADING_1, `Interview Feedback: ${f.target}`, 32));

  children.push(new Paragraph({ children: [text('Difficulty: ', { bold: true }), text(DIFFICULTY_LABEL[f.difficulty])], spacing: { after: 100 } }));
  children.push(new Paragraph({ children: [text('Overall rating: ', { bold: true }), text(RATING_LABEL[f.overallRating])], spacing: { after: 200 } }));
  children.push(new Paragraph({ children: [text(f.summary)], spacing: { after: 200 } }));

  if (f.strengths.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'What you did well', 28));
    for (const s of f.strengths) children.push(bullet(s));
  }

  children.push(heading(HeadingLevel.HEADING_2, 'What to work on', 28));

  f.improvements.forEach((imp, idx) => {
    children.push(heading(HeadingLevel.HEADING_3, `${idx + 1}. ${imp.area}`, 26));
    if (imp.why) children.push(new Paragraph({ children: [text('Why it matters: ', { bold: true }), text(imp.why)], spacing: { after: 100 } }));
    if (imp.example) {
      children.push(new Paragraph({ children: [text('Example reframe:', { bold: true })], spacing: { after: 50 } }));
      children.push(new Paragraph({
        children: [text(imp.example, { italics: true })],
        spacing: { after: 100 },
        indent: { left: 400 },
      }));
    }
  });

  if (f.perPhase.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'By phase', 28));
    for (const p of f.perPhase) {
      children.push(bullet(`${PHASE_LABEL[p.phase]}: ${p.note}`));
    }
  }

  if (f.nextSteps.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Next steps', 28));
    f.nextSteps.forEach((step, idx) => {
      children.push(new Paragraph({ children: [text(`${idx + 1}. ${step}`)], spacing: { after: 50 } }));
    });
  }

  if (sources && sources.length > 0) {
    children.push(heading(HeadingLevel.HEADING_2, 'Sources consulted', 28));
    sources.forEach((s, i) => {
      children.push(new Paragraph({ children: [text(`${i + 1}. ${s.title} — ${s.domain}`)], spacing: { after: 50 } }));
    });
  }

  children.push(new Paragraph({
    children: [text('AI-generated feedback. Treat as one perspective, not a verdict.', { italics: true, size: 20, color: '666666' })],
    spacing: { before: 400 },
  }));

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}
