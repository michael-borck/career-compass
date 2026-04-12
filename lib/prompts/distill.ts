import type { ChatMessage, StudentProfile } from '@/lib/session-store';

export type DistillationInput = {
  messages: ChatMessage[];
  trimmed?: boolean;
  guidance?: string;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
};

function formatTranscript(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.kind === 'message' || m.kind === 'attachment-summary')
    .map((m) => {
      const speaker =
        m.kind === 'attachment-summary'
          ? 'ATTACHMENT'
          : m.role === 'user'
          ? 'STUDENT'
          : 'ADVISOR';
      return `${speaker}: ${m.content}`;
    })
    .join('\n\n');
}

export function buildDistillationPrompt(input: DistillationInput): string {
  const sections: string[] = [];

  if (input.trimmed) {
    sections.push(
      'This is the recent portion of a longer conversation. Earlier messages were dropped to fit token limits — work with what you have.'
    );
  }

  sections.push(
    `Read the conversation below and distill it into a structured student profile. Respond ONLY with JSON in this exact shape:

{
  "background": string — a short paragraph about who the student is,
  "interests": string[] — career-relevant interests they've expressed,
  "skills": string[] — concrete skills they have or are building,
  "constraints": string[] — things limiting their options (location, time, visa, money, etc.),
  "goals": string[] — what they want from their career
}`
  );

  sections.push(`<conversation>\n${formatTranscript(input.messages)}\n</conversation>`);

  if (input.resume && input.resume.trim()) {
    sections.push(`<resume>\n${input.resume.trim()}\n</resume>`);
  }
  if (input.freeText && input.freeText.trim()) {
    sections.push(`<freeText>\n${input.freeText.trim()}\n</freeText>`);
  }
  if (input.jobTitle && input.jobTitle.trim()) {
    sections.push(`<jobTitleOfInterest>${input.jobTitle.trim()}</jobTitleOfInterest>`);
  }

  if (input.guidance && input.guidance.trim()) {
    sections.push(`<guidanceFromStudent>\n${input.guidance.trim()}\n</guidanceFromStudent>`);
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

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

export function parseDistilledProfile(raw: string): StudentProfile {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseDistilledProfile: not an object');
  }
  if (typeof parsed.background !== 'string' || !parsed.background.trim()) {
    throw new Error('parseDistilledProfile: missing background');
  }
  return {
    background: parsed.background,
    interests: toStringArray(parsed.interests),
    skills: toStringArray(parsed.skills),
    constraints: toStringArray(parsed.constraints),
    goals: toStringArray(parsed.goals),
  };
}
