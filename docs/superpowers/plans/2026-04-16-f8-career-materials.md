# F8 Career Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three career materials (elevator pitch, cover letter, resume review) with a new Materials pillar on the landing page, DOCX export for cover letters, and a career card dropdown menu refactor.

**Architecture:** Three new routes (`/pitch`, `/cover-letter`, `/resume-review`) following the endpoint-owned-inputs pattern. Three pure prompt builder/parser modules with TDD. Three thin API routes. `docx` package for cover letter DOCX export. Career card refactored from flat button row to grouped dropdown menu. Landing grid expanded from 3 to 4 pillars.

**Tech Stack:** Next.js 14 App Router, Zustand, Vitest, `docx` (npm), shadcn `DropdownMenu` (Radix), `lucide-react`, `react-hot-toast`.

**Spec:** `docs/superpowers/specs/2026-04-16-f8-career-materials-design.md`

---

## File Structure

**New files:**
- `lib/prompts/pitch.ts` + `lib/prompts/pitch.test.ts`
- `lib/prompts/cover-letter.ts` + `lib/prompts/cover-letter.test.ts`
- `lib/prompts/resume-review.ts` + `lib/prompts/resume-review.test.ts`
- `app/api/pitch/route.ts`
- `app/api/coverLetter/route.ts`
- `app/api/resumeReview/route.ts`
- `app/pitch/page.tsx`
- `app/cover-letter/page.tsx`
- `app/resume-review/page.tsx`
- `components/pitch/PitchInputCard.tsx`
- `components/pitch/PitchResultView.tsx`
- `components/cover-letter/CoverLetterInputCard.tsx`
- `components/cover-letter/CoverLetterResultView.tsx`
- `components/cover-letter/cover-letter-docx.ts`
- `components/resume-review/ResumeReviewInputCard.tsx`
- `components/resume-review/ResumeReviewResultView.tsx`
- `components/ui/dropdown-menu.tsx` (shadcn component)

**Modified files:**
- `lib/session-store.ts` + `lib/session-store.test.ts`
- `lib/markdown-export.ts` + `lib/markdown-export.test.ts`
- `components/landing/ActionCards.tsx`
- `components/landing/SessionBanner.tsx`
- `components/Hero.tsx`
- `components/CareerNode.tsx`
- `components/results/GapAnalysisView.tsx`
- `components/results/LearningPathView.tsx`
- `package.json` + `package-lock.json` (add `docx`)

---

## Task 1: Install dependencies + add shadcn DropdownMenu

**Files:**
- Modify: `package.json`
- Create: `components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Install the `docx` package**

Run: `npm install docx`

- [ ] **Step 2: Create the shadcn DropdownMenu component**

The project already has Radix UI as a dependency (used by `dialog.tsx`). Create `components/ui/dropdown-menu.tsx` following the shadcn pattern. Read `components/ui/dialog.tsx` for the style conventions (`cn` import, `forwardRef`, Studio Calm-compatible classes).

Run: `npx shadcn-ui@latest add dropdown-menu`

If this command fails (no shadcn config), manually create the file based on the shadcn source. The component exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuGroup`. Uses `@radix-ui/react-dropdown-menu` which should be installed by the shadcn command or manually: `npm install @radix-ui/react-dropdown-menu`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/ui/dropdown-menu.tsx
git commit -m "chore: add docx package and shadcn DropdownMenu component"
```

---

## Task 2: Session store — materials types, fields, actions

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
describe('career materials', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('elevatorPitch, coverLetter, resumeReview initialise null', () => {
    const s = useSessionStore.getState();
    expect(s.elevatorPitch).toBeNull();
    expect(s.coverLetter).toBeNull();
    expect(s.resumeReview).toBeNull();
  });

  it('setElevatorPitch writes and clears', () => {
    const pitch = {
      target: 'Data analyst',
      hook: 'h',
      body: 'b',
      close: 'c',
      fullScript: 'h b c',
    };
    useSessionStore.getState().setElevatorPitch(pitch);
    expect(useSessionStore.getState().elevatorPitch).toEqual(pitch);
    useSessionStore.getState().setElevatorPitch(null);
    expect(useSessionStore.getState().elevatorPitch).toBeNull();
  });

  it('setCoverLetter writes and clears', () => {
    const letter = { target: 'Analyst', greeting: 'Dear Hiring Manager,', body: 'I am writing...', closing: 'Sincerely, Student' };
    useSessionStore.getState().setCoverLetter(letter);
    expect(useSessionStore.getState().coverLetter).toEqual(letter);
    useSessionStore.getState().setCoverLetter(null);
    expect(useSessionStore.getState().coverLetter).toBeNull();
  });

  it('setResumeReview writes and clears', () => {
    const review = {
      target: 'Analyst',
      overallImpression: 'Solid foundation.',
      strengths: ['Clear structure'],
      improvements: [{ section: 'Summary', suggestion: 'Add a target', why: 'Focus', example: 'Aspiring data analyst...' }],
      keywordsToAdd: ['SQL'],
      structuralNotes: ['Move projects above education'],
    };
    useSessionStore.getState().setResumeReview(review);
    expect(useSessionStore.getState().resumeReview).toEqual(review);
    useSessionStore.getState().setResumeReview(null);
    expect(useSessionStore.getState().resumeReview).toBeNull();
  });

  it('reset() clears all three materials', () => {
    useSessionStore.getState().setElevatorPitch({ target: null, hook: 'h', body: 'b', close: 'c', fullScript: 'f' });
    useSessionStore.getState().setCoverLetter({ target: 't', greeting: 'g', body: 'b', closing: 'c' });
    useSessionStore.getState().setResumeReview({
      target: null, overallImpression: 'o', strengths: [], improvements: [],
      keywordsToAdd: [], structuralNotes: [],
    });
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.elevatorPitch).toBeNull();
    expect(s.coverLetter).toBeNull();
    expect(s.resumeReview).toBeNull();
  });

  it('resetOutputs() clears all three materials', () => {
    useSessionStore.getState().setElevatorPitch({ target: null, hook: 'h', body: 'b', close: 'c', fullScript: 'f' });
    useSessionStore.getState().setCoverLetter({ target: 't', greeting: 'g', body: 'b', closing: 'c' });
    useSessionStore.getState().setResumeReview({
      target: null, overallImpression: 'o', strengths: [], improvements: [],
      keywordsToAdd: [], structuralNotes: [],
    });
    useSessionStore.getState().setResume('r', 'r.pdf');
    useSessionStore.getState().resetOutputs();
    const s = useSessionStore.getState();
    expect(s.elevatorPitch).toBeNull();
    expect(s.coverLetter).toBeNull();
    expect(s.resumeReview).toBeNull();
    expect(s.resumeText).toBe('r');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/session-store.test.ts` — expect FAIL.

- [ ] **Step 3: Add types, fields, and actions**

Add types above `SessionState`:

```ts
export type ElevatorPitch = {
  target: string | null;
  hook: string;
  body: string;
  close: string;
  fullScript: string;
};

export type CoverLetter = {
  target: string;
  greeting: string;
  body: string;
  closing: string;
};

export type ResumeReviewItem = {
  section: string;
  suggestion: string;
  why: string;
  example: string;
};

export type ResumeReview = {
  target: string | null;
  overallImpression: string;
  strengths: string[];
  improvements: ResumeReviewItem[];
  keywordsToAdd: string[];
  structuralNotes: string[];
};
```

Add to `SessionState`:

```ts
  // Materials
  elevatorPitch: ElevatorPitch | null;
  coverLetter: CoverLetter | null;
  resumeReview: ResumeReview | null;
```

Add actions:

```ts
  setElevatorPitch: (p: ElevatorPitch | null) => void;
  setCoverLetter: (l: CoverLetter | null) => void;
  setResumeReview: (r: ResumeReview | null) => void;
```

Add to `initialState`:

```ts
  elevatorPitch: null,
  coverLetter: null,
  resumeReview: null,
```

Add implementations:

```ts
  setElevatorPitch: (p) => set({ elevatorPitch: p }),
  setCoverLetter: (l) => set({ coverLetter: l }),
  setResumeReview: (r) => set({ resumeReview: r }),
```

`reset()` and `resetOutputs()` already clear these automatically via `set({ ...initialState, ...inputFields })`.

- [ ] **Step 4:** Run `npx vitest run lib/session-store.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add ElevatorPitch, CoverLetter, ResumeReview types and actions"
```

---

## Task 3: Prompt builders + parsers (all three, TDD)

**Files:**
- Create: `lib/prompts/pitch.ts` + `lib/prompts/pitch.test.ts`
- Create: `lib/prompts/cover-letter.ts` + `lib/prompts/cover-letter.test.ts`
- Create: `lib/prompts/resume-review.ts` + `lib/prompts/resume-review.test.ts`

This is a large task — three prompt modules, each with tests. Follow TDD for each: write test file, run (fail), implement, run (pass), commit. Three commits total.

- [ ] **Step 1: Pitch prompt — write tests**

Create `lib/prompts/pitch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPitchPrompt, parsePitch } from './pitch';

describe('buildPitchPrompt', () => {
  it('includes profile when provided', () => {
    const out = buildPitchPrompt({ resume: 'Third-year student at Curtin.' });
    expect(out).toContain('Curtin');
  });

  it('includes target when provided', () => {
    const out = buildPitchPrompt({ jobTitle: 'Data analyst' });
    expect(out).toContain('Data analyst');
  });

  it('asks for hook/body/close/fullScript JSON shape', () => {
    const out = buildPitchPrompt({ jobTitle: 'Analyst' });
    expect(out).toContain('"hook"');
    expect(out).toContain('"body"');
    expect(out).toContain('"close"');
    expect(out).toContain('"fullScript"');
  });

  it('works with minimal input', () => {
    const out = buildPitchPrompt({ freeText: 'I like data.' });
    expect(out).toContain('I like data');
  });
});

describe('parsePitch', () => {
  const happy = JSON.stringify({
    hook: 'Did you know data drives every decision?',
    body: 'I bring three years of analytical experience.',
    close: 'I am looking for an entry-level analyst role.',
    fullScript: 'Did you know data drives every decision? I bring three years of analytical experience. I am looking for an entry-level analyst role.',
  });

  it('parses happy path', () => {
    const out = parsePitch(happy);
    expect(out.hook).toContain('data drives');
    expect(out.fullScript).toContain('analytical experience');
  });

  it('strips code fences', () => {
    const out = parsePitch('```json\n' + happy + '\n```');
    expect(out.hook).toContain('data');
  });

  it('throws on missing hook', () => {
    expect(() => parsePitch(JSON.stringify({ body: 'b', close: 'c', fullScript: 'f' }))).toThrow(/hook/i);
  });

  it('throws on missing body', () => {
    expect(() => parsePitch(JSON.stringify({ hook: 'h', close: 'c', fullScript: 'f' }))).toThrow(/body/i);
  });

  it('throws on missing fullScript', () => {
    expect(() => parsePitch(JSON.stringify({ hook: 'h', body: 'b', close: 'c' }))).toThrow(/fullScript/i);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/prompts/pitch.test.ts` — expect FAIL.

- [ ] **Step 3: Implement `lib/prompts/pitch.ts`**

```ts
import type { StudentProfile } from '@/lib/session-store';

export type PitchInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type PitchOutput = {
  hook: string;
  body: string;
  close: string;
  fullScript: string;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildProfileSection(input: PitchInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(Minimal profile provided. Keep the pitch general.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildPitchPrompt(input: PitchInput): string {
  const sections: string[] = [];

  sections.push(
    `Write a 30-60 second elevator pitch (about 150-200 words) for a student. The pitch should be conversational, written in first person, and suitable for a networking event or career fair.`
  );

  sections.push(
    `Structure the pitch in three parts:
- Hook: An opening line that grabs attention and sets the scene (1 sentence).
- Body: 2-3 key strengths or experiences that connect the student to their goals or target role (3-5 sentences).
- Close: What the student is looking for and a call to action (1-2 sentences).

Also produce a fullScript that joins hook, body, and close into one naturally flowing spoken paragraph.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "hook": string,
  "body": string,
  "close": string,
  "fullScript": string
}`
  );

  if (input.jobTitle && input.jobTitle.trim()) {
    sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  }
  if (input.jobAdvert && input.jobAdvert.trim()) {
    sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
  }

  sections.push(buildProfileSection(input));
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

export function parsePitch(raw: string): PitchOutput {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parsePitch: not an object');
  if (typeof parsed.hook !== 'string' || !parsed.hook.trim()) throw new Error('parsePitch: missing hook');
  if (typeof parsed.body !== 'string' || !parsed.body.trim()) throw new Error('parsePitch: missing body');
  if (typeof parsed.close !== 'string' || !parsed.close.trim()) throw new Error('parsePitch: missing close');
  if (typeof parsed.fullScript !== 'string' || !parsed.fullScript.trim()) throw new Error('parsePitch: missing fullScript');
  return {
    hook: parsed.hook.trim(),
    body: parsed.body.trim(),
    close: parsed.close.trim(),
    fullScript: parsed.fullScript.trim(),
  };
}
```

- [ ] **Step 4:** Run `npx vitest run lib/prompts/pitch.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/pitch.ts lib/prompts/pitch.test.ts
git commit -m "feat(pitch): add buildPitchPrompt and parsePitch"
```

- [ ] **Step 6: Cover letter prompt — write tests**

Create `lib/prompts/cover-letter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCoverLetterPrompt, parseCoverLetter } from './cover-letter';

describe('buildCoverLetterPrompt', () => {
  it('includes job title as target', () => {
    const out = buildCoverLetterPrompt({ jobTitle: 'Data analyst' });
    expect(out).toContain('Data analyst');
  });

  it('includes job advert when provided', () => {
    const out = buildCoverLetterPrompt({ jobAdvert: 'We are hiring a Graduate Analyst at Acme Corp.' });
    expect(out).toContain('Acme Corp');
  });

  it('includes resume as profile', () => {
    const out = buildCoverLetterPrompt({ resume: 'Third-year student at Curtin.', jobTitle: 'Analyst' });
    expect(out).toContain('Curtin');
  });

  it('asks for greeting/body/closing JSON shape', () => {
    const out = buildCoverLetterPrompt({ jobTitle: 'Analyst' });
    expect(out).toContain('"greeting"');
    expect(out).toContain('"body"');
    expect(out).toContain('"closing"');
  });
});

describe('parseCoverLetter', () => {
  const happy = JSON.stringify({
    greeting: 'Dear Hiring Manager,',
    body: 'I am writing to express my interest in the Data Analyst position.\n\nWith my background in statistics...',
    closing: 'Thank you for your consideration.\n\nSincerely,\nStudent Name',
  });

  it('parses happy path', () => {
    const out = parseCoverLetter(happy);
    expect(out.greeting).toContain('Hiring Manager');
    expect(out.body).toContain('Data Analyst');
    expect(out.closing).toContain('Sincerely');
  });

  it('strips code fences', () => {
    const out = parseCoverLetter('```json\n' + happy + '\n```');
    expect(out.greeting).toContain('Hiring');
  });

  it('throws on missing greeting', () => {
    expect(() => parseCoverLetter(JSON.stringify({ body: 'b', closing: 'c' }))).toThrow(/greeting/i);
  });

  it('throws on missing body', () => {
    expect(() => parseCoverLetter(JSON.stringify({ greeting: 'g', closing: 'c' }))).toThrow(/body/i);
  });

  it('throws on missing closing', () => {
    expect(() => parseCoverLetter(JSON.stringify({ greeting: 'g', body: 'b' }))).toThrow(/closing/i);
  });
});
```

- [ ] **Step 7:** Run `npx vitest run lib/prompts/cover-letter.test.ts` — expect FAIL.

- [ ] **Step 8: Implement `lib/prompts/cover-letter.ts`**

```ts
import type { StudentProfile } from '@/lib/session-store';

export type CoverLetterInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type CoverLetterOutput = {
  greeting: string;
  body: string;
  closing: string;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildProfileSection(input: CoverLetterInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(No profile provided. Write a general cover letter.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildCoverLetterPrompt(input: CoverLetterInput): string {
  const sections: string[] = [];

  sections.push(
    `Write a professional cover letter (300-500 words) for a student applying to a role. The letter should be formal but human — not robotic. Written in first person.`
  );

  sections.push(
    `Structure:
- Greeting: Professional salutation (use "Dear Hiring Manager," if no company name is known).
- Body: Opening paragraph (why this role interests the student), 1-2 middle paragraphs (connecting experience and skills to the role requirements), closing paragraph (call to action, availability, enthusiasm). Separate paragraphs with double newlines.
- Closing: Professional sign-off (e.g., "Sincerely," followed by a newline and the student's name or "[Your Name]" if unknown).`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "greeting": string,
  "body": string (multiple paragraphs separated by \\n\\n),
  "closing": string
}`
  );

  if (input.jobTitle && input.jobTitle.trim()) {
    sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  }
  if (input.jobAdvert && input.jobAdvert.trim()) {
    sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
  }

  sections.push(buildProfileSection(input));
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

export function parseCoverLetter(raw: string): CoverLetterOutput {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parseCoverLetter: not an object');
  if (typeof parsed.greeting !== 'string' || !parsed.greeting.trim()) throw new Error('parseCoverLetter: missing greeting');
  if (typeof parsed.body !== 'string' || !parsed.body.trim()) throw new Error('parseCoverLetter: missing body');
  if (typeof parsed.closing !== 'string' || !parsed.closing.trim()) throw new Error('parseCoverLetter: missing closing');
  return {
    greeting: parsed.greeting.trim(),
    body: parsed.body.trim(),
    closing: parsed.closing.trim(),
  };
}
```

- [ ] **Step 9:** Run `npx vitest run lib/prompts/cover-letter.test.ts` — expect PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/prompts/cover-letter.ts lib/prompts/cover-letter.test.ts
git commit -m "feat(cover-letter): add buildCoverLetterPrompt and parseCoverLetter"
```

- [ ] **Step 11: Resume review prompt — write tests**

Create `lib/prompts/resume-review.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildResumeReviewPrompt, parseResumeReview } from './resume-review';

describe('buildResumeReviewPrompt', () => {
  it('includes the resume', () => {
    const out = buildResumeReviewPrompt({ resume: 'Three years of data work at Curtin.' });
    expect(out).toContain('Curtin');
  });

  it('includes target when provided', () => {
    const out = buildResumeReviewPrompt({ resume: 'r', jobTitle: 'Data analyst' });
    expect(out).toContain('Data analyst');
  });

  it('asks for the review JSON shape', () => {
    const out = buildResumeReviewPrompt({ resume: 'r' });
    expect(out).toContain('"overallImpression"');
    expect(out).toContain('"strengths"');
    expect(out).toContain('"improvements"');
    expect(out).toContain('"keywordsToAdd"');
    expect(out).toContain('"structuralNotes"');
  });
});

describe('parseResumeReview', () => {
  const happy = JSON.stringify({
    overallImpression: 'Solid foundation with room for improvement.',
    strengths: ['Clear structure', 'Relevant experience'],
    improvements: [
      { section: 'Summary', suggestion: 'Add a target role', why: 'Focus signals intent', example: 'Aspiring data analyst with 2 years...' },
      { section: 'Skills', suggestion: 'Add SQL', why: 'Most analyst roles require it', example: 'Technical skills: Python, SQL, Tableau' },
    ],
    keywordsToAdd: ['SQL', 'data visualization'],
    structuralNotes: ['Move projects section above education'],
  });

  it('parses happy path', () => {
    const out = parseResumeReview(happy);
    expect(out.overallImpression).toContain('Solid');
    expect(out.strengths).toHaveLength(2);
    expect(out.improvements).toHaveLength(2);
    expect(out.improvements[0].section).toBe('Summary');
    expect(out.keywordsToAdd).toContain('SQL');
    expect(out.structuralNotes).toHaveLength(1);
  });

  it('strips code fences', () => {
    const out = parseResumeReview('```json\n' + happy + '\n```');
    expect(out.overallImpression).toContain('Solid');
  });

  it('throws on missing overallImpression', () => {
    expect(() => parseResumeReview(JSON.stringify({
      strengths: [], improvements: [], keywordsToAdd: [], structuralNotes: [],
    }))).toThrow(/overallImpression/i);
  });

  it('coerces missing arrays to empty', () => {
    const minimal = JSON.stringify({
      overallImpression: 'OK.',
      improvements: [{ section: 's', suggestion: 'sg', why: 'w', example: 'e' }],
    });
    const out = parseResumeReview(minimal);
    expect(out.strengths).toEqual([]);
    expect(out.keywordsToAdd).toEqual([]);
    expect(out.structuralNotes).toEqual([]);
  });

  it('throws when improvements is empty', () => {
    expect(() => parseResumeReview(JSON.stringify({
      overallImpression: 'OK.',
      improvements: [],
    }))).toThrow(/improvement/i);
  });
});
```

- [ ] **Step 12:** Run `npx vitest run lib/prompts/resume-review.test.ts` — expect FAIL.

- [ ] **Step 13: Implement `lib/prompts/resume-review.ts`**

```ts
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

  sections.push(
    `Review the student's resume below. Give structured, actionable feedback. Be honest but encouraging — always call out what is working before suggesting changes. Do not rewrite the entire resume; instead, suggest specific improvements with example rewrites of individual lines or sections.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "overallImpression": string (2-3 sentences summarising the resume's strengths and weaknesses),
  "strengths": string[] (2-4 things the resume does well),
  "improvements": [
    {
      "section": string (which part of the resume, e.g. "Summary", "Work Experience", "Skills"),
      "suggestion": string (what to change),
      "why": string (why this matters to a recruiter or hiring manager),
      "example": string (a rewritten version of that line or section)
    }
  ] (3-6 improvements, ordered by impact — most important first),
  "keywordsToAdd": string[] (keywords to add if a target role is provided, empty array if no target),
  "structuralNotes": string[] (suggestions about section ordering, formatting, or layout)
}`
  );

  sections.push(`<resume>\n${input.resume.trim()}\n</resume>`);

  if (input.jobTitle && input.jobTitle.trim()) {
    sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  }
  if (input.jobAdvert && input.jobAdvert.trim()) {
    sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
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

export function parseResumeReview(raw: string): ResumeReviewOutput {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('parseResumeReview: not an object');
  if (typeof parsed.overallImpression !== 'string' || !parsed.overallImpression.trim()) {
    throw new Error('parseResumeReview: missing overallImpression');
  }

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
  if (improvements.length === 0) {
    throw new Error('parseResumeReview: needs at least one improvement');
  }

  return {
    overallImpression: parsed.overallImpression.trim(),
    strengths: toStringArray(parsed.strengths),
    improvements,
    keywordsToAdd: toStringArray(parsed.keywordsToAdd),
    structuralNotes: toStringArray(parsed.structuralNotes),
  };
}
```

- [ ] **Step 14:** Run `npx vitest run lib/prompts/resume-review.test.ts` — expect PASS.

- [ ] **Step 15: Commit**

```bash
git add lib/prompts/resume-review.ts lib/prompts/resume-review.test.ts
git commit -m "feat(resume-review): add buildResumeReviewPrompt and parseResumeReview"
```

---

## Task 4: Markdown exporters (all three, TDD)

**Files:**
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

- [ ] **Step 1: Write tests for all three**

Append to `lib/markdown-export.test.ts`:

```ts
import { pitchToMarkdown, coverLetterToMarkdown, resumeReviewToMarkdown } from './markdown-export';
import type { ElevatorPitch, CoverLetter, ResumeReview } from './session-store';

describe('pitchToMarkdown', () => {
  const pitch: ElevatorPitch = {
    target: 'Data analyst',
    hook: 'Did you know data drives every decision?',
    body: 'I bring analytical experience.',
    close: 'I am looking for an entry-level role.',
    fullScript: 'Did you know data drives every decision? I bring analytical experience. I am looking for an entry-level role.',
  };

  it('renders all sections', () => {
    const md = pitchToMarkdown(pitch);
    expect(md).toContain('# Elevator Pitch');
    expect(md).toContain('**Target:** Data analyst');
    expect(md).toContain('## Your hook');
    expect(md).toContain('## The pitch');
    expect(md).toContain('## Your close');
    expect(md).toContain('## Full script');
    expect(md).toContain('data drives');
  });

  it('renders null target as General', () => {
    const md = pitchToMarkdown({ ...pitch, target: null });
    expect(md).toContain('**Target:** General');
  });

  it('ends with footer', () => {
    expect(pitchToMarkdown(pitch).trim()).toMatch(/Edit to match your voice/);
  });
});

describe('coverLetterToMarkdown', () => {
  const letter: CoverLetter = {
    target: 'Data analyst at Acme',
    greeting: 'Dear Hiring Manager,',
    body: 'I am writing to express my interest.\n\nWith my background in statistics...',
    closing: 'Sincerely,\nStudent Name',
  };

  it('renders the letter', () => {
    const md = coverLetterToMarkdown(letter);
    expect(md).toContain('# Cover Letter');
    expect(md).toContain('**Target:** Data analyst at Acme');
    expect(md).toContain('Dear Hiring Manager,');
    expect(md).toContain('I am writing');
    expect(md).toContain('Sincerely,');
  });

  it('ends with footer', () => {
    expect(coverLetterToMarkdown(letter).trim()).toMatch(/Edit before sending/);
  });
});

describe('resumeReviewToMarkdown', () => {
  const review: ResumeReview = {
    target: 'Data analyst',
    overallImpression: 'Solid foundation.',
    strengths: ['Clear structure'],
    improvements: [{ section: 'Summary', suggestion: 'Add target', why: 'Focus', example: 'Aspiring data analyst...' }],
    keywordsToAdd: ['SQL'],
    structuralNotes: ['Move projects above education'],
  };

  it('renders all sections', () => {
    const md = resumeReviewToMarkdown(review);
    expect(md).toContain('# Resume Review');
    expect(md).toContain('**Target:** Data analyst');
    expect(md).toContain('## Overall impression');
    expect(md).toContain("## What's working");
    expect(md).toContain('## Suggested improvements');
    expect(md).toContain('### 1. Summary');
    expect(md).toContain('**Suggestion:**');
    expect(md).toContain('**Example:**');
    expect(md).toContain('## Keywords to add');
    expect(md).toContain('## Structural notes');
  });

  it('renders null target as General review', () => {
    const md = resumeReviewToMarkdown({ ...review, target: null });
    expect(md).toContain('**Target:** General review');
  });

  it('skips empty sections', () => {
    const md = resumeReviewToMarkdown({ ...review, keywordsToAdd: [], structuralNotes: [] });
    expect(md).not.toContain('## Keywords to add');
    expect(md).not.toContain('## Structural notes');
  });

  it('ends with footer', () => {
    expect(resumeReviewToMarkdown(review).trim()).toMatch(/starting point/);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/markdown-export.test.ts` — expect FAIL.

- [ ] **Step 3: Add all three functions to `lib/markdown-export.ts`**

Add `ElevatorPitch, CoverLetter, ResumeReview, ResumeReviewItem` to the existing import from `./session-store`.

Append:

```ts
export function pitchToMarkdown(p: ElevatorPitch): string {
  const lines: string[] = [];
  lines.push('# Elevator Pitch');
  lines.push('');
  lines.push(`**Target:** ${p.target ?? 'General'}`);
  lines.push('');
  lines.push('## Your hook');
  lines.push(p.hook);
  lines.push('');
  lines.push('## The pitch');
  lines.push(p.body);
  lines.push('');
  lines.push('## Your close');
  lines.push(p.close);
  lines.push('');
  lines.push('## Full script');
  lines.push(p.fullScript);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*AI-generated pitch. Edit to match your voice before using.*');
  return lines.join('\n');
}

export function coverLetterToMarkdown(l: CoverLetter): string {
  const lines: string[] = [];
  lines.push('# Cover Letter');
  lines.push('');
  lines.push(`**Target:** ${l.target}`);
  lines.push('');
  lines.push(l.greeting);
  lines.push('');
  lines.push(l.body);
  lines.push('');
  lines.push(l.closing);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*AI-generated draft. Edit before sending.*');
  return lines.join('\n');
}

export function resumeReviewToMarkdown(r: ResumeReview): string {
  const lines: string[] = [];
  lines.push('# Resume Review');
  lines.push('');
  lines.push(`**Target:** ${r.target ?? 'General review'}`);
  lines.push('');
  lines.push('## Overall impression');
  lines.push(r.overallImpression);
  lines.push('');

  if (r.strengths.length > 0) {
    lines.push("## What's working");
    for (const s of r.strengths) lines.push(`- ${s}`);
    lines.push('');
  }

  lines.push('## Suggested improvements');
  lines.push('');
  r.improvements.forEach((imp, idx) => {
    lines.push(`### ${idx + 1}. ${imp.section}`);
    lines.push(`**Suggestion:** ${imp.suggestion}`);
    if (imp.why) lines.push(`**Why:** ${imp.why}`);
    if (imp.example) lines.push(`**Example:** "${imp.example}"`);
    lines.push('');
  });

  if (r.keywordsToAdd.length > 0) {
    lines.push('## Keywords to add');
    for (const k of r.keywordsToAdd) lines.push(`- ${k}`);
    lines.push('');
  }

  if (r.structuralNotes.length > 0) {
    lines.push('## Structural notes');
    for (const n of r.structuralNotes) lines.push(`- ${n}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('*AI-generated feedback. Use as a starting point, not a final verdict.*');
  return lines.join('\n');
}
```

- [ ] **Step 4:** Run `npx vitest run lib/markdown-export.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "feat(export): add pitchToMarkdown, coverLetterToMarkdown, resumeReviewToMarkdown"
```

---

## Task 5: Three API routes

**Files:**
- Create: `app/api/pitch/route.ts`
- Create: `app/api/coverLetter/route.ts`
- Create: `app/api/resumeReview/route.ts`

All three follow the identical thin-wrapper pattern: validate inputs, build prompt, call LLM, trim-retry, parse, return. Create all three, verify with `npx tsc --noEmit`, commit.

- [ ] **Step 1: Create all three route files**

Each follows the pattern from `app/api/board/route.ts` — read it for reference. Key differences:
- **pitch:** no required fields (at least one of resume/freeText/jobTitle/jobAdvert must be non-empty). System message: "You write elevator pitches. You ONLY respond in JSON."
- **coverLetter:** requires at least one of jobTitle/jobAdvert (400 if missing). System message: "You write professional cover letters. You ONLY respond in JSON."
- **resumeReview:** requires resume (400 if missing). System message: "You review resumes and give structured feedback. You ONLY respond in JSON."

All three use `isTokenLimitError` for trim-retry (trim jobAdvert first, then resume, then 500).

The pitch route returns `{ pitch, trimmed }`. Cover letter returns `{ letter, trimmed }`. Resume review returns `{ review, trimmed }`.

I'll provide the full code for each. The implementer creates all three files then runs `npx tsc --noEmit`.

`app/api/pitch/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildPitchPrompt, parsePitch, type PitchInput } from '@/lib/prompts/pitch';
import { isTokenLimitError } from '@/lib/token-limit';

interface PitchRequest extends PitchInput { llmConfig?: LLMConfig; }

const SYSTEM = 'You write elevator pitches for students. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } = (await request.json()) as PitchRequest;
    const hasAny = !!(input.resume?.trim() || input.freeText?.trim() || input.jobTitle?.trim() || input.jobAdvert?.trim() || input.distilledProfile);
    if (!hasAny) {
      return new Response(JSON.stringify({ error: 'Provide at least some profile or target information.' }), { status: 400 });
    }
    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    let trimmed = false;
    let raw: string;
    try {
      raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPitchPrompt(input) }], llmConfig);
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = { ...input, jobAdvert: input.jobAdvert?.slice(0, 4000) };
      try {
        raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPitchPrompt(shorter) }], llmConfig);
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        const shorter2 = { ...shorter, resume: input.resume?.slice(0, 4000) };
        raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPitchPrompt(shorter2) }], llmConfig);
      }
    }
    const target = input.jobTitle?.trim() || input.jobAdvert?.trim().split('\n')[0].slice(0, 60) || null;
    const pitch = { target, ...parsePitch(raw!) };
    return new Response(JSON.stringify({ pitch, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[pitch] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
  }
}
```

`app/api/coverLetter/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildCoverLetterPrompt, parseCoverLetter, type CoverLetterInput } from '@/lib/prompts/cover-letter';
import { isTokenLimitError } from '@/lib/token-limit';

interface CoverLetterRequest extends CoverLetterInput { llmConfig?: LLMConfig; }

const SYSTEM = 'You write professional cover letters for students. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } = (await request.json()) as CoverLetterRequest;
    const hasTarget = !!(input.jobTitle?.trim() || input.jobAdvert?.trim());
    if (!hasTarget) {
      return new Response(JSON.stringify({ error: 'A cover letter needs a target role. Add a job title or paste a job advert.' }), { status: 400 });
    }
    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    let trimmed = false;
    let raw: string;
    try {
      raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCoverLetterPrompt(input) }], llmConfig);
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = { ...input, jobAdvert: input.jobAdvert?.slice(0, 4000) };
      try {
        raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCoverLetterPrompt(shorter) }], llmConfig);
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        const shorter2 = { ...shorter, resume: input.resume?.slice(0, 4000) };
        raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildCoverLetterPrompt(shorter2) }], llmConfig);
      }
    }
    const target = input.jobTitle?.trim() || input.jobAdvert?.trim().split('\n')[0].slice(0, 60) || 'this role';
    const letter = { target, ...parseCoverLetter(raw!) };
    return new Response(JSON.stringify({ letter, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[coverLetter] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
  }
}
```

`app/api/resumeReview/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildResumeReviewPrompt, parseResumeReview, type ResumeReviewInput } from '@/lib/prompts/resume-review';
import { isTokenLimitError } from '@/lib/token-limit';

interface ResumeReviewRequest extends ResumeReviewInput { llmConfig?: LLMConfig; }

const SYSTEM = 'You review resumes and give structured, actionable feedback. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } = (await request.json()) as ResumeReviewRequest;
    if (!input.resume || !input.resume.trim()) {
      return new Response(JSON.stringify({ error: 'Resume review needs a resume to review.' }), { status: 400 });
    }
    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);
    let trimmed = false;
    let raw: string;
    try {
      raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildResumeReviewPrompt(input) }], llmConfig);
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      const shorter = { ...input, jobAdvert: input.jobAdvert?.slice(0, 4000) };
      try {
        raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildResumeReviewPrompt(shorter) }], llmConfig);
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        const shorter2 = { ...shorter, resume: input.resume.slice(0, 4000) };
        raw = await provider.createCompletion([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildResumeReviewPrompt(shorter2) }], llmConfig);
      }
    }
    const target = input.jobTitle?.trim() || null;
    const review = { target, ...parseResumeReview(raw!) };
    return new Response(JSON.stringify({ review, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[resumeReview] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
  }
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit` — expect clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/pitch/route.ts app/api/coverLetter/route.ts app/api/resumeReview/route.ts
git commit -m "feat(api): add /api/pitch, /api/coverLetter, /api/resumeReview routes"
```

---

## Task 6: Input cards + result views + DOCX export + endpoint pages (all three materials)

This is the largest task — 3 input cards, 3 result views, 1 DOCX helper, 3 page orchestrators. The implementer should create all files, verify `npx tsc --noEmit`, then commit per material.

**The implementer should read the following files for patterns before starting:**
- `components/gap-analysis/GapAnalysisInputCard.tsx` — pattern for input cards
- `app/gap-analysis/page.tsx` — pattern for three-state page orchestrator
- `components/results/GapAnalysisView.tsx` — pattern for result views with collapsible items
- `components/results/GapItem.tsx` — pattern for collapsible improvement items

**For each material, the pattern is identical:**

Page orchestrator:
```tsx
// Three states: result exists → render ResultView
//               no result + required inputs → auto-run
//               no result + missing inputs → render InputCard
```

Input card:
```tsx
// All fields the action can use, pre-filled from store
// Required fields unmarked, optional fields marked "(optional)"
// Run button disabled until requirements met
// NO back link (page shell owns navigation)
```

Result view:
```tsx
// Renders the material output
// Copy as Markdown button
// Save as DOCX button (cover letter only)
```

I won't repeat the full code for all 10 files here — it would make the plan enormous. Instead, I'll specify the exact interface for each file so the implementer knows what to build.

- [ ] **Step 1: Create pitch components + page**

**`components/pitch/PitchInputCard.tsx`:**
- Fields: Resume (optional, LocalFileUpload), About you (optional, Textarea), Job title (optional, Input), Job advert (optional, Textarea). All pre-filled from store.
- Helper: "The more you provide, the more tailored the pitch. A target role makes it specific."
- Run button: "Write my pitch" with Presentation icon. Disabled until at least one field is non-empty.
- On run: POST `/api/pitch` with `{ resume, freeText, jobTitle, jobAdvert, distilledProfile, llmConfig }`. On success: `store.setElevatorPitch(pitch)`.
- Includes `isLLMConfigured()` pre-flight, toast on error.

**`components/pitch/PitchResultView.tsx`:**
- Renders: editorial-rule header "Elevator Pitch", target line, hook section (quoted), body section, close section (quoted), full script in a bordered block.
- Copy as Markdown via `CopyMarkdownButton` with `getMarkdown={() => pitchToMarkdown(pitch)}`.

**`app/pitch/page.tsx`:**
- Page shell: Back to landing + Start over (+ Copy as Markdown / "Write another" when result exists).
- Three states: result → PitchResultView, auto-run if any input present + no result, input card if nothing.
- Auto-run: same `autoRanRef` pattern as gap-analysis page.
- "Write another": clears `elevatorPitch`, returns to input card.

Commit:
```bash
git add components/pitch/ app/pitch/
git commit -m "feat(pitch): add PitchInputCard, PitchResultView, and /pitch page"
```

- [ ] **Step 2: Create cover letter components + DOCX + page**

**`components/cover-letter/cover-letter-docx.ts`:**
```ts
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import type { CoverLetter } from '@/lib/session-store';

export async function coverLetterToDocx(letter: CoverLetter): Promise<Blob> {
  const bodyParagraphs = letter.body.split('\n\n').filter(Boolean).map(
    (text) => new Paragraph({
      children: [new TextRun({ text, size: 24, font: 'Calibri' })],
      spacing: { after: 200 },
    })
  );

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ text: letter.greeting, size: 24, font: 'Calibri' })],
          spacing: { after: 200 },
        }),
        ...bodyParagraphs,
        new Paragraph({
          children: [new TextRun({ text: letter.closing, size: 24, font: 'Calibri' })],
          spacing: { before: 200 },
        }),
      ],
    }],
  });

  return await Packer.toBlob(doc);
}
```

**`components/cover-letter/CoverLetterInputCard.tsx`:**
- Fields: Resume (optional), About you (optional), Job title (Input), Job advert (Textarea). Pre-filled from store.
- Helper: "A cover letter works best with a specific job advert. The more profile detail, the more personalised."
- Run button: "Draft cover letter" with FileText icon. Disabled until at least one of jobTitle/jobAdvert is non-empty.
- On run: POST `/api/coverLetter`. On success: `store.setCoverLetter(letter)`.

**`components/cover-letter/CoverLetterResultView.tsx`:**
- Renders: editorial-rule "Cover Letter", target line, greeting, body (split by `\n\n` into paragraphs), closing.
- Copy as Markdown via `CopyMarkdownButton`.
- **Save as DOCX button:** calls `coverLetterToDocx(letter)`, creates object URL, triggers download via temporary `<a>` element. Filename: `cover-letter-{target-slugified}.docx`.

**`app/cover-letter/page.tsx`:**
- Page shell same pattern.
- Three states. Auto-run when target exists + no letter.
- "Draft another": clears `coverLetter`.

Commit:
```bash
git add components/cover-letter/ app/cover-letter/
git commit -m "feat(cover-letter): add input card, result view, DOCX export, and /cover-letter page"
```

- [ ] **Step 3: Create resume review components + page**

**`components/resume-review/ResumeReviewInputCard.tsx`:**
- Fields: Resume (required — prominent, NOT marked optional), Job title (optional), Job advert (optional). Pre-filled from store.
- Helper: "Upload your resume for feedback. Add a target role for tailored suggestions."
- Run button: "Review my resume" with ClipboardCheck icon. Disabled until resume is present.
- On run: POST `/api/resumeReview`. On success: `store.setResumeReview(review)`.

**`components/resume-review/ResumeReviewResultView.tsx`:**
- Renders: editorial-rule "Resume Review", target line, overall impression, strengths (bullets), improvements (collapsible cards — collapsed: section + suggestion, expanded: why + example), keywords to add (bullets, skip if empty), structural notes (bullets, skip if empty).
- Improvement items: use a local `expanded` state Record, same pattern as GapItem toggling.
- Copy as Markdown.

**`app/resume-review/page.tsx`:**
- Page shell same pattern.
- Three states. Auto-run when resume exists + no review. (Resume is the only hard requirement.)
- "Review again": clears `resumeReview`.

Commit:
```bash
git add components/resume-review/ app/resume-review/
git commit -m "feat(resume-review): add input card, result view, and /resume-review page"
```

- [ ] **Step 4: Verify all**

Run: `npx tsc --noEmit && npx vitest run`

---

## Task 7: Landing page — Materials pillar + grid update + Hero tagline

**Files:**
- Modify: `components/landing/ActionCards.tsx`
- Modify: `components/landing/SessionBanner.tsx`
- Modify: `components/Hero.tsx`

- [ ] **Step 1: Add Materials pillar to ActionCards**

Add imports: `Presentation, FileText, ClipboardCheck` from lucide-react.

Add a fourth column definition:

```ts
  const materials: CardDef[] = [
    {
      icon: <Presentation className='w-5 h-5' />,
      title: 'Elevator pitch',
      description: 'Write a 30-60 second pitch for networking.',
      hover: 'Works with any combination of profile and target role.',
      path: '/pitch',
    },
    {
      icon: <FileText className='w-5 h-5' />,
      title: 'Cover letter',
      description: 'Draft a professional letter for applications.',
      hover: 'Works best with a specific job advert.',
      path: '/cover-letter',
    },
    {
      icon: <ClipboardCheck className='w-5 h-5' />,
      title: 'Resume review',
      description: 'Get structured feedback on your resume.',
      hover: 'Needs a resume. Add a target role for tailored suggestions.',
      path: '/resume-review',
    },
  ];
```

Add the fourth column to the render:

```tsx
  return (
    <div className='w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-6'>
      {renderColumn('Discover', discover)}
      {renderColumn('Assess', assess)}
      {renderColumn('Reflect', reflect)}
      {renderColumn('Materials', materials)}
    </div>
  );
```

Note the grid change: `md:grid-cols-2 lg:grid-cols-4` (was `md:grid-cols-3`).

- [ ] **Step 2: Add output links to SessionBanner**

Add to the store destructure: `elevatorPitch, coverLetter, resumeReview`.

Add detection:
```ts
  const hasPitch = !!elevatorPitch;
  const hasCoverLetter = !!coverLetter;
  const hasResumeReview = !!resumeReview;
```

Add to `hasAnyOutput`:
```ts
  const hasAnyOutput = hasCareers || hasChat || hasGap || hasPath ||
    hasInterviewInProgress || hasInterviewFeedback ||
    hasOdyssey || hasBoard || hasComparison ||
    hasPitch || hasCoverLetter || hasResumeReview;
```

Add links:
```tsx
  {hasPitch && <Link href='/pitch' className='underline hover:text-accent'>pitch ready</Link>}
  {hasCoverLetter && <Link href='/cover-letter' className='underline hover:text-accent'>cover letter ready</Link>}
  {hasResumeReview && <Link href='/resume-review' className='underline hover:text-accent'>resume review ready</Link>}
```

- [ ] **Step 3: Update Hero tagline**

Add "Build what you need." to the subtitle:

```tsx
<p className='mt-5 max-w-xl mx-auto text-ink-muted text-[var(--text-base)] leading-relaxed'>
  Explore what's possible. Understand what it takes. Reflect on what fits. Build what you need.
</p>
```

- [ ] **Step 4: Verify and commit**

```bash
git add components/landing/ActionCards.tsx components/landing/SessionBanner.tsx components/Hero.tsx
git commit -m "feat(landing): add Materials pillar with 4-column grid and updated tagline"
```

---

## Task 8: Career card dropdown refactor

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Read the file**

Read `components/CareerNode.tsx`. Note the current flat button row in the dialog content.

- [ ] **Step 2: Add imports**

Add shadcn DropdownMenu imports:
```ts
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Presentation, FileText } from 'lucide-react';
```

(Keep existing lucide imports, add `ChevronDown`, `Presentation`, `FileText`.)

- [ ] **Step 3: Add pitch and cover letter handlers**

```ts
  function handleWritePitch() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    useSessionStore.getState().setElevatorPitch(null);
    router.push('/pitch');
  }

  function handleDraftCoverLetter() {
    if (!jobTitle) return;
    setStoreJobTitle(jobTitle);
    useSessionStore.getState().setCoverLetter(null);
    router.push('/cover-letter');
  }
```

- [ ] **Step 4: Replace the flat button row with a dropdown + compare toggle**

Find the `<div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4 mt-4'>` section. Replace the entire contents with:

```tsx
        <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-4 mt-4'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline'>
                Actions
                <ChevronDown className='w-4 h-4 ml-2' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-64'>
              <DropdownMenuLabel>Discover</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleChatAboutThis}>
                <MessageCircle className='w-4 h-4 mr-2' /> Chat about this role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Assess</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleAnalyseGaps}>
                <SearchCheck className='w-4 h-4 mr-2' /> Analyse gaps for this role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLearningPath}>
                <RouteIcon className='w-4 h-4 mr-2' /> Learning path for this role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePracticeInterview}>
                <Mic className='w-4 h-4 mr-2' /> Practice interview for this role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Reflect</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleBoardShortcut}>
                <Users className='w-4 h-4 mr-2' /> Ask the board about this role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Materials</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleWritePitch}>
                <Presentation className='w-4 h-4 mr-2' /> Write a pitch for this role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDraftCoverLetter}>
                <FileText className='w-4 h-4 mr-2' /> Draft a cover letter for this role
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant='outline'
            size='sm'
            onClick={() => useSessionStore.getState().toggleComparing(data.jobTitle ?? '')}
            disabled={atMaxComparison}
            title={atMaxComparison ? 'Maximum 3 roles. Remove one to add another.' : undefined}
          >
            {inComparison ? (
              <><X className='w-3 h-3 mr-1' /> Remove from comparison</>
            ) : (
              <><Columns3 className='w-3 h-3 mr-1' /> Compare this role</>
            )}
          </Button>
        </div>
```

Note: the "Chat about this role" item wraps a `<Link>` — the existing handler uses `<Button asChild>` with a `<Link href='/chat'>`. In the dropdown, use `onClick` with `router.push('/chat')` after calling `handleChatAboutThis`. Or keep it as is if DropdownMenuItem supports `asChild` with Link. The implementer should check.

- [ ] **Step 5: Verify and commit**

```bash
git add components/CareerNode.tsx
git commit -m "refactor(careers): replace flat button row with grouped Actions dropdown menu"
```

---

## Task 9: Chain-outs from gap analysis + learning path result views

**Files:**
- Modify: `components/results/GapAnalysisView.tsx`
- Modify: `components/results/LearningPathView.tsx`

- [ ] **Step 1: Add pitch + cover letter chain buttons to GapAnalysisView**

Import `Presentation, FileText` from lucide-react. Add handlers:

```ts
  function handleWritePitch() {
    store.setElevatorPitch(null);
    router.push('/pitch');
  }

  function handleDraftCoverLetter() {
    store.setCoverLetter(null);
    router.push('/cover-letter');
  }
```

Add buttons to the existing chain row at the bottom:

```tsx
  <div className='flex flex-wrap justify-end gap-3'>
    <Button variant='outline' onClick={handleWritePitch}>
      <Presentation className='w-4 h-4 mr-2' />
      Write a pitch for this target
    </Button>
    <Button variant='outline' onClick={handleDraftCoverLetter}>
      <FileText className='w-4 h-4 mr-2' />
      Draft a cover letter for this target
    </Button>
    <Button variant='outline' onClick={handlePracticeInterview}>
      Practice interview for this target →
    </Button>
    <Button onClick={handleChainToLearningPath}>
      Turn this into a learning path →
    </Button>
  </div>
```

- [ ] **Step 2: Same for LearningPathView**

Add the same imports, handlers, and buttons to the chain row.

- [ ] **Step 3: Verify and commit**

```bash
git add components/results/GapAnalysisView.tsx components/results/LearningPathView.tsx
git commit -m "feat(chain-outs): add pitch and cover letter chains to gap and learning views"
```

---

## Task 10: Manual QA

**Files:** none (verification only)

- [ ] **Step 1:** Run `npx vitest run` — all tests green.

- [ ] **Step 2:** Run `npm run electron:dev`

- [ ] **Step 3: Walk the QA checklist from the spec**

All items from the spec's manual QA section, plus:
- Landing page four pillars visible on large screen
- Landing 2x2 on medium screen
- Materials pillar: three cards with correct icons
- Click Elevator pitch → input card → fill job title → Run → pitch result
- Pitch result: hook/body/close sections + full script block + Copy as Markdown
- Click Cover letter → input card → fill job advert → Run → cover letter result
- Cover letter: Save as DOCX → file downloads, opens in Word
- Click Resume review with no resume → input card, Run disabled, resume upload prominent
- Upload resume → Run → review with improvements (collapsible)
- Career card dialog: Actions dropdown with grouped sections
- Dropdown "Write a pitch" → /pitch with target pre-filled
- Dropdown "Draft a cover letter" → /cover-letter with target pre-filled
- Gap analysis chain buttons: "Write a pitch" and "Draft a cover letter" work
- Learning path chain buttons: same
- SessionBanner: "pitch ready", "cover letter ready", "resume review ready" links
- Start over clears all three materials
- Tagline: "...Build what you need."

---

## Notes for the implementer

- **`docx` package:** the `Packer.toBlob()` method is async. The DOCX generation happens client-side — no server route needed.
- **DOCX download pattern:** use `URL.createObjectURL(blob)` + temporary `<a download>`. Works in both Electron and browser.
- **Temperature:** pitch route ~0.6, cover letter route ~0.4, resume review route ~0.5. These are passed to `createCompletion` if the provider supports it, or ignored if not.
- **The pitch's `target` is inferred by the route** from `jobTitle` or the first line of `jobAdvert`. The prompt builder doesn't include it as a field — the parser returns `hook/body/close/fullScript`, and the route wraps it with `target`.
- **Cover letter `body` may contain `\n\n`** for paragraph breaks. The result view splits on `\n\n` to render separate `<p>` elements. The DOCX export splits the same way to create separate `Paragraph` nodes.
- **Resume review improvements are collapsible** — use the same toggle pattern as `GapItem`. Local `expanded: Record<number, boolean>` state with `toggle(i)`.
- **DropdownMenu from shadcn** needs `@radix-ui/react-dropdown-menu`. If `npx shadcn-ui@latest add dropdown-menu` doesn't work, install manually and create the component file following the shadcn source.
- **The career card's "Chat about this role" currently uses `<Button asChild><Link>`.** In the dropdown, this becomes a `DropdownMenuItem` with `onClick` that calls `handleChatAboutThis()` then programmatically navigates. The `Link` wrapper is no longer needed inside the dropdown.
- **`fileToArrayBuffer`** helper is duplicated in each input card. This is intentional per the established pattern. If it bothers the implementer, extract to `lib/utils.ts` (check if it already exists there).
