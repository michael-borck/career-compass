import type { StudentProfile } from '@/lib/session-store';

export type CareersInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type CareerBasicInfo = {
  jobTitle: string;
  jobDescription: string;
  timeline: string;
  salary: string;
  difficulty: string;
};

export type CareerDetailInfo = {
  workRequired: string;
  aboutTheRole: string;
  whyItsagoodfit: string[];
  roadmap: { [key: string]: string }[];
};

const EXAMPLE = `<example>
[
  {
    "jobTitle": "UX Designer",
    "jobDescription": "Creates user-centered design solutions to improve product usability and user experience.",
    "timeline": "3-6 months",
    "salary": "$85k - $110k",
    "difficulty": "Medium"
  },
  {
    "jobTitle": "Digital Marketing Specialist",
    "jobDescription": "Develops and implements online marketing campaigns to drive business growth.",
    "timeline": "2-4 months",
    "salary": "$50k - $70k",
    "difficulty": "Low"
  }
]
</example>`;

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

export function buildCareersPrompt(input: CareersInput): string {
  const { resume, freeText, jobTitle, jobAdvert, distilledProfile } = input;

  const hasAny =
    (resume && resume.trim()) ||
    (freeText && freeText.trim()) ||
    (jobTitle && jobTitle.trim()) ||
    (jobAdvert && jobAdvert.trim()) ||
    distilledProfile;

  if (!hasAny) {
    throw new Error('buildCareersPrompt: at least one input is required');
  }

  const sections: string[] = [];

  sections.push(
    `Give me 6 career paths that the following user could transition into based on the information below. Respond in JSON: {jobTitle: string, jobDescription: string, timeline: string, salary: string, difficulty: string}.`
  );

  sections.push(EXAMPLE);

  if (jobTitle && jobTitle.trim()) {
    sections.push(
      `<jobTitleOfInterest>\nThe student is curious about becoming a ${jobTitle.trim()}. Generate 6 adjacent or alternative career paths they might explore, including the stated one and variants/progressions.\n</jobTitleOfInterest>`
    );
  }

  if (jobAdvert && jobAdvert.trim()) {
    sections.push(`<jobAdvert>\n${jobAdvert.trim()}\n</jobAdvert>`);
  }

  if (resume && resume.trim()) {
    sections.push(`<resume>\n${resume.trim()}\n</resume>`);
  }

  if (freeText && freeText.trim()) {
    sections.push(`<additionalContext>\n${freeText.trim()}\n</additionalContext>`);
  }

  if (distilledProfile) {
    sections.push(
      `<distilledProfile>\n${formatProfile(distilledProfile)}\n</distilledProfile>`
    );
  }

  sections.push('ONLY respond with JSON, nothing else.');

  return sections.join('\n\n');
}

export function buildCareerDetailPrompt(
  career: { jobTitle: string; timeline: string },
  input: CareersInput
): string {
  const parts: string[] = [];
  if (input.resume) parts.push(input.resume);
  if (input.freeText) parts.push(input.freeText);
  if (input.jobTitle) parts.push(`Student stated interest: ${input.jobTitle}`);
  if (input.jobAdvert) parts.push(`Job advert of interest:\n${input.jobAdvert}`);
  if (input.distilledProfile) parts.push(formatProfile(input.distilledProfile));

  const context = parts.join('\n\n');

  return `You are helping a person transition into the ${career.jobTitle} role in ${career.timeline}. Given the context about the person, return more information about the ${career.jobTitle} role in JSON as follows: {workRequired: string, aboutTheRole: string, whyItsagoodfit: array[], roadmap: [{string: string}, ...]}

<context>
${context}
</context>

ONLY respond with JSON, nothing else.`;
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

function toString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function parseCareersList(raw: string): CareerBasicInfo[] {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!Array.isArray(parsed)) {
    throw new Error('parseCareersList: expected an array of careers');
  }
  return parsed.map((c: unknown) => {
    const obj = (c ?? {}) as Record<string, unknown>;
    return {
      jobTitle: toString(obj.jobTitle, 'Unknown role'),
      jobDescription: toString(obj.jobDescription),
      timeline: toString(obj.timeline),
      salary: toString(obj.salary),
      difficulty: toString(obj.difficulty),
    };
  });
}

export function parseCareerDetail(raw: string): CareerDetailInfo {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseCareerDetail: expected an object');
  }
  const obj = parsed as Record<string, unknown>;
  const roadmapRaw = Array.isArray(obj.roadmap) ? obj.roadmap : [];
  const roadmap: { [key: string]: string }[] = roadmapRaw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((step) => {
      const out: { [key: string]: string } = {};
      for (const [k, v] of Object.entries(step)) {
        out[k] = typeof v === 'string' ? v : String(v ?? '');
      }
      return out;
    });
  return {
    workRequired: toString(obj.workRequired),
    aboutTheRole: toString(obj.aboutTheRole),
    whyItsagoodfit: toStringArray(obj.whyItsagoodfit),
    roadmap,
  };
}
