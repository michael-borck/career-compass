import type { StudentProfile, ResumeReviewItem } from '@/lib/session-store';

export type ResumeReviewInput = {
  resume: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type ResumeReviewOutput = {
  overallImpression: string;
  strengths: string[];
  improvements: ResumeReviewItem[];
  keywordsToAdd: string[];
  structuralNotes: string[];
};

export function buildResumeReviewPrompt(input: ResumeReviewInput): string {
  const sections: string[] = [];
  sections.push('Review the student\'s resume below. Give structured, actionable feedback. Be honest but encouraging. Do not rewrite the entire resume; instead, suggest specific improvements with example rewrites of individual lines or sections.');
  sections.push('Respond with JSON in EXACTLY this shape (no prose, no code fences):\n\n{\n  "overallImpression": string (2-3 sentences),\n  "strengths": string[] (2-4 things the resume does well),\n  "improvements": [\n    {\n      "section": string (which part, e.g. "Summary", "Work Experience"),\n      "suggestion": string (what to change),\n      "why": string (why this matters),\n      "example": string (a rewritten version of that line or section)\n    }\n  ] (3-6 improvements, ordered by impact),\n  "keywordsToAdd": string[] (keywords to add if a target role is provided, empty if no target),\n  "structuralNotes": string[] (suggestions about section ordering, formatting)\n}');
  sections.push(`<resume>\n${input.resume.trim()}\n</resume>`);
  if (input.jobTitle?.trim()) sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  if (input.jobAdvert?.trim()) sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
  sections.push('ONLY respond with JSON. No prose, no code fences.');
  return sections.join('\n\n');
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  return cleaned.trim();
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export function parseResumeReview(raw: string): ResumeReviewOutput {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parseResumeReview: not an object');
  if (typeof parsed.overallImpression !== 'string' || !parsed.overallImpression.trim()) throw new Error('parseResumeReview: missing overallImpression');
  const improvements: ResumeReviewItem[] = [];
  if (Array.isArray(parsed.improvements)) {
    for (const imp of parsed.improvements) {
      if (!imp || typeof imp !== 'object') continue;
      improvements.push({
        section: typeof imp.section === 'string' ? imp.section.trim() : 'General',
        suggestion: typeof imp.suggestion === 'string' ? imp.suggestion.trim() : '',
        why: typeof imp.why === 'string' ? imp.why.trim() : '',
        example: typeof imp.example === 'string' ? imp.example.trim() : '',
      });
    }
  }
  if (improvements.length === 0) throw new Error('parseResumeReview: needs at least one improvement');
  return {
    overallImpression: parsed.overallImpression.trim(),
    strengths: toStringArray(parsed.strengths),
    improvements,
    keywordsToAdd: toStringArray(parsed.keywordsToAdd),
    structuralNotes: toStringArray(parsed.structuralNotes),
  };
}
