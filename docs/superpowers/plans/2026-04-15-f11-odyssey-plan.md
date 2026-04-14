# F11 Odyssey Plan Simulator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Designing Your Life Odyssey Plan Simulator — three alternative 5-year lives (Current / Pivot / Wildcard), student brainstorms seeds, LLM elaborates, student rates a 4-dimension dashboard, export as Markdown.

**Architecture:** New `/odyssey` route with card view + compare view. Two thin API routes (`odysseyElaborate`, `odysseySuggest`) delegating to pure prompt builders. Session store extended with three named life slots. Landing page `ActionsZone` refactored into three labelled groups (Discover / Assess / Reflect). Chat chain reuses `/api/distillProfile` with custom guidance to seed Life 1 only.

**Tech Stack:** Next.js 14 App Router, Zustand session store, Vitest for pure-function tests, Studio Calm design tokens, `react-hot-toast`, `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-04-15-f11-odyssey-plan-design.md` — the canonical source for prompts, types, UI, and scope.

---

## File Structure

**New files:**
- `lib/prompts/odyssey.ts` — elaborate prompt builder + parser
- `lib/prompts/odyssey.test.ts`
- `lib/prompts/odyssey-suggest.ts` — seed suggestion prompt builder + parser
- `lib/prompts/odyssey-suggest.test.ts`
- `app/api/odysseyElaborate/route.ts`
- `app/api/odysseySuggest/route.ts`
- `app/odyssey/page.tsx` — orchestrator with card + compare views
- `components/odyssey/OdysseyLifeCard.tsx`
- `components/odyssey/OdysseyElaboration.tsx` — shared read-only render
- `components/odyssey/OdysseyDashboard.tsx` — 4-dimension slider row
- `components/odyssey/OdysseyCompareView.tsx`

**Modified files:**
- `lib/session-store.ts` — new types, fields, actions
- `lib/session-store.test.ts` — extended tests
- `lib/markdown-export.ts` — `odysseyPlanToMarkdown`
- `lib/markdown-export.test.ts` — extended tests
- `app/globals.css` — `.editorial-rule.justify-center` modifier
- `components/landing/ActionsZone.tsx` — regroup into Discover / Assess / Reflect
- `components/landing/OutputsBanner.tsx` — odyssey quick-jump link
- `components/chat/ChatComposer.tsx` — optional `onOdyssey` prop
- `app/chat/page.tsx` — `handleOdyssey` handler

---

## Task 1: Session store — Odyssey types, state, actions

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';

describe('odyssey lives', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('initialises three empty life slots keyed by type', () => {
    const { odysseyLives } = useSessionStore.getState();
    expect(Object.keys(odysseyLives).sort()).toEqual(['current', 'pivot', 'wildcard']);
    for (const type of ['current', 'pivot', 'wildcard'] as const) {
      const life = odysseyLives[type];
      expect(life.type).toBe(type);
      expect(life.label).toBe('');
      expect(life.seed).toBe('');
      expect(life.headline).toBeNull();
      expect(life.dayInTheLife).toBeNull();
      expect(life.typicalWeek).toEqual([]);
      expect(life.toolsAndSkills).toEqual([]);
      expect(life.whoYouWorkWith).toBeNull();
      expect(life.challenges).toEqual([]);
      expect(life.questionsToExplore).toEqual([]);
      expect(life.dashboard).toEqual({
        resources: null,
        likability: null,
        confidence: null,
        coherence: null,
      });
    }
  });

  it('setOdysseySeed writes label and seed for a specific slot', () => {
    useSessionStore.getState().setOdysseySeed('pivot', 'Teacher', 'I become a high school teacher.');
    const life = useSessionStore.getState().odysseyLives.pivot;
    expect(life.label).toBe('Teacher');
    expect(life.seed).toBe('I become a high school teacher.');
    // Other slots untouched
    expect(useSessionStore.getState().odysseyLives.current.label).toBe('');
  });

  it('setOdysseyElaboration merges partial elaboration fields', () => {
    useSessionStore.getState().setOdysseyElaboration('wildcard', {
      headline: 'Living off-grid building furniture',
      dayInTheLife: 'Wake at 6, work in the shed until lunch...',
      typicalWeek: ['3 days in the workshop', '2 days delivering orders'],
      toolsAndSkills: ['hand tools', 'CAD basics'],
      whoYouWorkWith: 'Mostly solo, occasional clients.',
      challenges: ['Unstable income'],
      questionsToExplore: ['Where would I live?'],
    });
    const life = useSessionStore.getState().odysseyLives.wildcard;
    expect(life.headline).toBe('Living off-grid building furniture');
    expect(life.typicalWeek).toHaveLength(2);
    expect(life.challenges).toEqual(['Unstable income']);
  });

  it('setOdysseyDashboard sets and clears ratings', () => {
    useSessionStore.getState().setOdysseyDashboard('current', 'resources', 4);
    expect(useSessionStore.getState().odysseyLives.current.dashboard.resources).toBe(4);
    useSessionStore.getState().setOdysseyDashboard('current', 'resources', null);
    expect(useSessionStore.getState().odysseyLives.current.dashboard.resources).toBeNull();
  });

  it('resetOdysseyLife clears one slot without touching others', () => {
    useSessionStore.getState().setOdysseySeed('current', 'A', 'a');
    useSessionStore.getState().setOdysseySeed('pivot', 'B', 'b');
    useSessionStore.getState().resetOdysseyLife('current');
    expect(useSessionStore.getState().odysseyLives.current.label).toBe('');
    expect(useSessionStore.getState().odysseyLives.pivot.label).toBe('B');
  });

  it('reset() clears all three odyssey slots', () => {
    useSessionStore.getState().setOdysseySeed('current', 'A', 'a');
    useSessionStore.getState().setOdysseyDashboard('current', 'confidence', 5);
    useSessionStore.getState().reset();
    const { odysseyLives } = useSessionStore.getState();
    expect(odysseyLives.current.label).toBe('');
    expect(odysseyLives.current.dashboard.confidence).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/session-store.test.ts`
Expected: FAIL — `odysseyLives` is undefined, `setOdysseySeed` is not a function.

- [ ] **Step 3: Add Odyssey types, initial state, and actions to `lib/session-store.ts`**

Add these types above `SessionState`:

```ts
export type OdysseyLifeType = 'current' | 'pivot' | 'wildcard';

export type OdysseyDashboard = {
  resources: number | null;
  likability: number | null;
  confidence: number | null;
  coherence: number | null;
};

export type OdysseyLife = {
  type: OdysseyLifeType;
  label: string;
  seed: string;
  headline: string | null;
  dayInTheLife: string | null;
  typicalWeek: string[];
  toolsAndSkills: string[];
  whoYouWorkWith: string | null;
  challenges: string[];
  questionsToExplore: string[];
  dashboard: OdysseyDashboard;
};
```

Add to `SessionState` (near the `// Outputs` block):

```ts
  // Odyssey
  odysseyLives: Record<OdysseyLifeType, OdysseyLife>;
```

Add to the actions section of `SessionState`:

```ts
  setOdysseySeed: (type: OdysseyLifeType, label: string, seed: string) => void;
  setOdysseyElaboration: (type: OdysseyLifeType, elaboration: Partial<OdysseyLife>) => void;
  setOdysseyDashboard: (type: OdysseyLifeType, field: keyof OdysseyDashboard, value: number | null) => void;
  resetOdysseyLife: (type: OdysseyLifeType) => void;
```

Add a helper above `initialState`:

```ts
function makeEmptyLife(type: OdysseyLifeType): OdysseyLife {
  return {
    type,
    label: '',
    seed: '',
    headline: null,
    dayInTheLife: null,
    typicalWeek: [],
    toolsAndSkills: [],
    whoYouWorkWith: null,
    challenges: [],
    questionsToExplore: [],
    dashboard: {
      resources: null,
      likability: null,
      confidence: null,
      coherence: null,
    },
  };
}
```

Add to `initialState`:

```ts
  odysseyLives: {
    current: makeEmptyLife('current'),
    pivot: makeEmptyLife('pivot'),
    wildcard: makeEmptyLife('wildcard'),
  },
```

Add action implementations inside the `create<SessionState>` callback (near the interview actions):

```ts
  setOdysseySeed: (type, label, seed) =>
    set((s) => ({
      odysseyLives: {
        ...s.odysseyLives,
        [type]: { ...s.odysseyLives[type], label, seed },
      },
    })),

  setOdysseyElaboration: (type, elaboration) =>
    set((s) => ({
      odysseyLives: {
        ...s.odysseyLives,
        [type]: { ...s.odysseyLives[type], ...elaboration },
      },
    })),

  setOdysseyDashboard: (type, field, value) =>
    set((s) => ({
      odysseyLives: {
        ...s.odysseyLives,
        [type]: {
          ...s.odysseyLives[type],
          dashboard: { ...s.odysseyLives[type].dashboard, [field]: value },
        },
      },
    })),

  resetOdysseyLife: (type) =>
    set((s) => ({
      odysseyLives: { ...s.odysseyLives, [type]: makeEmptyLife(type) },
    })),
```

Note: `reset: () => set({ ...initialState })` already clears the odyssey slots automatically.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/session-store.test.ts`
Expected: PASS — all new odyssey tests green, existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add Odyssey Plan life slots, dashboard, and actions"
```

---

## Task 2: `lib/prompts/odyssey-suggest.ts` — seed suggester

**Files:**
- Create: `lib/prompts/odyssey-suggest.ts`
- Create: `lib/prompts/odyssey-suggest.test.ts`

- [ ] **Step 1: Write failing tests**

`lib/prompts/odyssey-suggest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSeedSuggestionPrompt, parseSeedSuggestion } from './odyssey-suggest';

describe('buildSeedSuggestionPrompt', () => {
  it('uses different framing for each life type', () => {
    const current = buildSeedSuggestionPrompt({ type: 'current' });
    const pivot = buildSeedSuggestionPrompt({ type: 'pivot' });
    const wildcard = buildSeedSuggestionPrompt({ type: 'wildcard' });
    expect(current).toMatch(/current trajectory|natural progression/i);
    expect(pivot).toMatch(/pivot|alternative/i);
    expect(wildcard).toMatch(/wildcard|money, image/i);
    expect(current).not.toBe(pivot);
    expect(pivot).not.toBe(wildcard);
  });

  it('asks for the JSON shape', () => {
    const out = buildSeedSuggestionPrompt({ type: 'current' });
    expect(out).toMatch(/"label"/);
    expect(out).toMatch(/"description"/);
  });

  it('includes profile text when provided', () => {
    const out = buildSeedSuggestionPrompt({
      type: 'pivot',
      resume: 'Third-year nursing student.',
    });
    expect(out).toContain('nursing student');
  });

  it('includes distilled profile when provided', () => {
    const out = buildSeedSuggestionPrompt({
      type: 'pivot',
      distilledProfile: {
        background: 'Nursing undergrad',
        interests: ['public health'],
        skills: ['patient communication'],
        constraints: [],
        goals: ['work in community health'],
      },
    });
    expect(out).toMatch(/nursing undergrad/i);
    expect(out).toMatch(/public health/i);
  });
});

describe('parseSeedSuggestion', () => {
  it('parses valid JSON', () => {
    const raw = '{"label":"Health data analyst","description":"I work for a small health nonprofit."}';
    expect(parseSeedSuggestion(raw)).toEqual({
      label: 'Health data analyst',
      description: 'I work for a small health nonprofit.',
    });
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"label":"A","description":"B"}\n```';
    expect(parseSeedSuggestion(raw)).toEqual({ label: 'A', description: 'B' });
  });

  it('throws when label is missing', () => {
    expect(() => parseSeedSuggestion('{"description":"B"}')).toThrow(/label/);
  });

  it('throws when description is missing', () => {
    expect(() => parseSeedSuggestion('{"label":"A"}')).toThrow(/description/);
  });

  it('throws when label is empty', () => {
    expect(() => parseSeedSuggestion('{"label":"","description":"B"}')).toThrow(/label/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prompts/odyssey-suggest.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/prompts/odyssey-suggest.ts`**

```ts
import type { StudentProfile, OdysseyLifeType } from '@/lib/session-store';

export type SeedSuggestionInput = {
  type: OdysseyLifeType;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type SeedSuggestion = {
  label: string;
  description: string;
};

const FRAMING: Record<OdysseyLifeType, string> = {
  current:
    "Based on the student's profile below, what's the most likely natural progression of their current trajectory over the next five years? Propose a one-to-two sentence seed for their Odyssey Plan Life 1 (Current Path) — what they seem to be heading toward if they keep going as they are.",
  pivot:
    "If the student's current path disappeared tomorrow, what's an alternative career that would use their existing skills in a meaningfully different way? Propose a seed for Life 2 (The Pivot) — same student, different trajectory.",
  wildcard:
    "If money, image, and reputation didn't matter, what's a wildly different life this student might find meaningful based on their interests and values? Propose a seed for Life 3 (The Wildcard) — be bold, this is the fantasy slot.",
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

function buildProfileSection(input: SeedSuggestionInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) parts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) parts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(The student has not provided profile information yet. Acknowledge this in the description.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildSeedSuggestionPrompt(input: SeedSuggestionInput): string {
  const sections = [
    FRAMING[input.type],
    buildProfileSection(input),
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "label": string (3-8 words, the name of this life),
  "description": string (1-2 sentences, written in first person from the student's point of view)
}

If the profile is thin, acknowledge that in the description ("Based on your limited profile, one possibility is...") rather than inventing details.

ONLY respond with JSON.`,
  ];
  return sections.join('\n\n');
}

function cleanJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

export function parseSeedSuggestion(raw: string): SeedSuggestion {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseSeedSuggestion: not an object');
  }
  if (typeof parsed.label !== 'string' || !parsed.label.trim()) {
    throw new Error('parseSeedSuggestion: missing label');
  }
  if (typeof parsed.description !== 'string' || !parsed.description.trim()) {
    throw new Error('parseSeedSuggestion: missing description');
  }
  return { label: parsed.label.trim(), description: parsed.description.trim() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prompts/odyssey-suggest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/odyssey-suggest.ts lib/prompts/odyssey-suggest.test.ts
git commit -m "feat(odyssey): add seed suggestion prompt builder and parser"
```

---

## Task 3: `lib/prompts/odyssey.ts` — elaborate prompt builder and parser

**Files:**
- Create: `lib/prompts/odyssey.ts`
- Create: `lib/prompts/odyssey.test.ts`

- [ ] **Step 1: Write failing tests**

`lib/prompts/odyssey.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildOdysseyElaboratePrompt, parseOdysseyElaboration } from './odyssey';

describe('buildOdysseyElaboratePrompt', () => {
  const base = {
    type: 'current' as const,
    label: 'Data analyst in a health nonprofit',
    seed: 'I finish my degree and join a small health research org.',
  };

  it('includes the label, seed, and type framing', () => {
    const out = buildOdysseyElaboratePrompt(base);
    expect(out).toContain('Data analyst in a health nonprofit');
    expect(out).toContain('I finish my degree');
    expect(out).toMatch(/current trajectory|natural extension/i);
  });

  it('uses different framing for pivot vs wildcard', () => {
    const pivot = buildOdysseyElaboratePrompt({ ...base, type: 'pivot' });
    const wildcard = buildOdysseyElaboratePrompt({ ...base, type: 'wildcard' });
    expect(pivot).toMatch(/pivot/i);
    expect(wildcard).toMatch(/wildcard|money, image/i);
    expect(pivot).not.toBe(wildcard);
  });

  it('asks for the full elaboration JSON shape', () => {
    const out = buildOdysseyElaboratePrompt(base);
    for (const key of ['headline', 'dayInTheLife', 'typicalWeek', 'toolsAndSkills', 'whoYouWorkWith', 'challenges', 'questionsToExplore']) {
      expect(out).toContain(`"${key}"`);
    }
  });

  it('includes profile context when provided', () => {
    const out = buildOdysseyElaboratePrompt({
      ...base,
      resume: 'Third-year public health student at Curtin.',
    });
    expect(out).toContain('Curtin');
  });

  it('includes distilled profile when provided', () => {
    const out = buildOdysseyElaboratePrompt({
      ...base,
      distilledProfile: {
        background: 'Public health undergrad',
        interests: ['community health'],
        skills: ['statistics'],
        constraints: [],
        goals: ['policy role'],
      },
    });
    expect(out).toContain('Public health undergrad');
  });
});

describe('parseOdysseyElaboration', () => {
  const full = JSON.stringify({
    headline: 'Turning data into health policy',
    dayInTheLife: 'Morning stand-up with the team, then cleaning survey data...',
    typicalWeek: ['2 days analysis', '1 day stakeholder meetings'],
    toolsAndSkills: ['Python', 'Tableau'],
    whoYouWorkWith: 'Small team of researchers and program staff.',
    challenges: ['Lower salary', 'Funding instability'],
    questionsToExplore: ['Which orgs hire for this?', 'What qualifications do I need?'],
  });

  it('parses a full elaboration', () => {
    const out = parseOdysseyElaboration(full);
    expect(out.headline).toBe('Turning data into health policy');
    expect(out.typicalWeek).toHaveLength(2);
    expect(out.challenges).toHaveLength(2);
  });

  it('strips markdown code fences', () => {
    const out = parseOdysseyElaboration('```json\n' + full + '\n```');
    expect(out.headline).toBe('Turning data into health policy');
  });

  it('throws when headline is missing', () => {
    const broken = JSON.stringify({ dayInTheLife: 'x', whoYouWorkWith: 'y' });
    expect(() => parseOdysseyElaboration(broken)).toThrow(/headline/);
  });

  it('throws when dayInTheLife is missing', () => {
    const broken = JSON.stringify({ headline: 'x', whoYouWorkWith: 'y' });
    expect(() => parseOdysseyElaboration(broken)).toThrow(/dayInTheLife/);
  });

  it('throws when whoYouWorkWith is missing', () => {
    const broken = JSON.stringify({ headline: 'x', dayInTheLife: 'y' });
    expect(() => parseOdysseyElaboration(broken)).toThrow(/whoYouWorkWith/);
  });

  it('coerces missing optional arrays to empty arrays', () => {
    const minimal = JSON.stringify({
      headline: 'h',
      dayInTheLife: 'd',
      whoYouWorkWith: 'w',
    });
    const out = parseOdysseyElaboration(minimal);
    expect(out.typicalWeek).toEqual([]);
    expect(out.toolsAndSkills).toEqual([]);
    expect(out.challenges).toEqual([]);
    expect(out.questionsToExplore).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prompts/odyssey.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/prompts/odyssey.ts`**

```ts
import type { StudentProfile, OdysseyLifeType } from '@/lib/session-store';

export type OdysseyElaborateInput = {
  type: OdysseyLifeType;
  label: string;
  seed: string;
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export type OdysseyElaboration = {
  headline: string;
  dayInTheLife: string;
  typicalWeek: string[];
  toolsAndSkills: string[];
  whoYouWorkWith: string;
  challenges: string[];
  questionsToExplore: string[];
};

const FRAMING: Record<OdysseyLifeType, string> = {
  current:
    "This is the student's current trajectory — the most natural extension of what they're already doing.",
  pivot:
    "This is a pivot — a different career that uses some of the same skills but heads in a new direction.",
  wildcard:
    "This is a wildcard — an unconventional life the student might pursue if money, image, and reputation didn't matter.",
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

function buildProfileSection(input: OdysseyElaborateInput): string {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.jobTitle && input.jobTitle.trim()) parts.push(`Current job title:\n${input.jobTitle.trim()}`);
  if (input.jobAdvert && input.jobAdvert.trim()) parts.push(`Target job advert:\n${input.jobAdvert.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(No profile provided. Keep the elaboration generic but still vivid.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildOdysseyElaboratePrompt(input: OdysseyElaborateInput): string {
  const sections = [
    `You are helping a student imagine a possible future life for their Odyssey Plan. ${FRAMING[input.type]} The student's seed is below. Elaborate it into a concrete, vivid 5-year-future vision.`,
    `Make the elaboration tangible and honest. Use specific details (not "works with computers" — "uses Python and Tableau to clean data from regional clinics"). Be honest about challenges — every life has downsides. The student needs to feel what this life would actually be like.`,
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "headline": string — 5-8 word pithy summary of the fleshed-out life,
  "dayInTheLife": string — vivid paragraph describing a typical day in 2030,
  "typicalWeek": string[] — 4-6 bullet points on the rhythm of the week,
  "toolsAndSkills": string[] — concrete tools, tech, skills used,
  "whoYouWorkWith": string — 1-2 sentences on the people and setting,
  "challenges": string[] — 3-5 honest trade-offs and difficulties,
  "questionsToExplore": string[] — 3-5 things the student would need to learn or decide
}`,
    `<lifeSeed>\nLabel: ${input.label}\nSeed: ${input.seed}\n</lifeSeed>`,
    buildProfileSection(input),
    'ONLY respond with JSON. No prose, no code fences.',
  ];
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

export function parseOdysseyElaboration(raw: string): OdysseyElaboration {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseOdysseyElaboration: not an object');
  }
  if (typeof parsed.headline !== 'string' || !parsed.headline.trim()) {
    throw new Error('parseOdysseyElaboration: missing headline');
  }
  if (typeof parsed.dayInTheLife !== 'string' || !parsed.dayInTheLife.trim()) {
    throw new Error('parseOdysseyElaboration: missing dayInTheLife');
  }
  if (typeof parsed.whoYouWorkWith !== 'string' || !parsed.whoYouWorkWith.trim()) {
    throw new Error('parseOdysseyElaboration: missing whoYouWorkWith');
  }
  return {
    headline: parsed.headline.trim(),
    dayInTheLife: parsed.dayInTheLife.trim(),
    typicalWeek: toStringArray(parsed.typicalWeek),
    toolsAndSkills: toStringArray(parsed.toolsAndSkills),
    whoYouWorkWith: parsed.whoYouWorkWith.trim(),
    challenges: toStringArray(parsed.challenges),
    questionsToExplore: toStringArray(parsed.questionsToExplore),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prompts/odyssey.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/odyssey.ts lib/prompts/odyssey.test.ts
git commit -m "feat(odyssey): add elaborate prompt builder and parser"
```

---

## Task 4: `lib/markdown-export.ts` — `odysseyPlanToMarkdown`

**Files:**
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/markdown-export.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { odysseyPlanToMarkdown } from './markdown-export';
import type { OdysseyLife, OdysseyLifeType } from './session-store';

function makeLife(type: OdysseyLifeType, overrides: Partial<OdysseyLife> = {}): OdysseyLife {
  return {
    type,
    label: '',
    seed: '',
    headline: null,
    dayInTheLife: null,
    typicalWeek: [],
    toolsAndSkills: [],
    whoYouWorkWith: null,
    challenges: [],
    questionsToExplore: [],
    dashboard: { resources: null, likability: null, confidence: null, coherence: null },
    ...overrides,
  };
}

function fullyElaborated(type: OdysseyLifeType, label: string): OdysseyLife {
  return makeLife(type, {
    label,
    seed: 'seed text',
    headline: `${label} headline`,
    dayInTheLife: `A day for ${label}`,
    typicalWeek: ['Mon: a', 'Tue: b'],
    toolsAndSkills: ['tool1', 'tool2'],
    whoYouWorkWith: `People of ${label}`,
    challenges: ['ch1', 'ch2'],
    questionsToExplore: ['q1', 'q2'],
    dashboard: { resources: 3, likability: 4, confidence: 2, coherence: 5 },
  });
}

describe('odysseyPlanToMarkdown', () => {
  it('renders three elaborated lives with headers, day, week, tools, who, challenges, questions, dashboard', () => {
    const md = odysseyPlanToMarkdown({
      current: fullyElaborated('current', 'Current Path'),
      pivot: fullyElaborated('pivot', 'The Pivot'),
      wildcard: fullyElaborated('wildcard', 'The Wildcard'),
    });
    expect(md).toContain('# Odyssey Plan');
    expect(md).toContain('## Life 1 — Current Path');
    expect(md).toContain('## Life 2 — The Pivot');
    expect(md).toContain('## Life 3 — The Wildcard');
    expect(md).toContain('### A day in 2030');
    expect(md).toContain('### Typical week');
    expect(md).toContain('### Tools & skills');
    expect(md).toContain('### Who you work with');
    expect(md).toContain('### Challenges');
    expect(md).toContain('### Questions to explore');
    expect(md).toContain('### How does this feel?');
    expect(md).toContain('**Resources:** 3/5');
    expect(md).toContain('**Likability:** 4/5');
    expect(md).toContain('**Confidence:** 2/5');
    expect(md).toContain('**Coherence:** 5/5');
  });

  it('shows placeholder note for unelaborated lives with a seed', () => {
    const md = odysseyPlanToMarkdown({
      current: fullyElaborated('current', 'Current Path'),
      pivot: makeLife('pivot', { label: 'Pivot idea', seed: 'something' }),
      wildcard: makeLife('wildcard'),
    });
    expect(md).toContain('This life has not been elaborated yet.');
    expect(md).toContain('Pivot idea');
  });

  it('renders null dashboard values as "— not yet rated"', () => {
    const md = odysseyPlanToMarkdown({
      current: fullyElaborated('current', 'Current'),
      pivot: fullyElaborated('pivot', 'Pivot'),
      wildcard: fullyElaborated('wildcard', 'Wildcard'),
    });
    // Override one to null dashboard
    const md2 = odysseyPlanToMarkdown({
      current: { ...fullyElaborated('current', 'Current'), dashboard: { resources: null, likability: null, confidence: null, coherence: null } },
      pivot: fullyElaborated('pivot', 'Pivot'),
      wildcard: fullyElaborated('wildcard', 'Wildcard'),
    });
    expect(md2).toContain('**Resources:** — not yet rated');
    expect(md2).toContain('**Coherence:** — not yet rated');
  });

  it('renders mixed dashboard with only rated dimensions as N/5', () => {
    const life = fullyElaborated('current', 'Mixed');
    life.dashboard = { resources: 3, likability: null, confidence: 4, coherence: null };
    const md = odysseyPlanToMarkdown({
      current: life,
      pivot: makeLife('pivot'),
      wildcard: makeLife('wildcard'),
    });
    expect(md).toContain('**Resources:** 3/5');
    expect(md).toContain('**Likability:** — not yet rated');
    expect(md).toContain('**Confidence:** 4/5');
  });

  it('ends with the AI-generated footer', () => {
    const md = odysseyPlanToMarkdown({
      current: makeLife('current'),
      pivot: makeLife('pivot'),
      wildcard: makeLife('wildcard'),
    });
    expect(md.trim().endsWith('*AI-generated elaboration. Dashboard ratings are your own reflection.*')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/markdown-export.test.ts`
Expected: FAIL — `odysseyPlanToMarkdown` not exported.

- [ ] **Step 3: Add `odysseyPlanToMarkdown` to `lib/markdown-export.ts`**

Add to the imports at the top of the file:

```ts
import type { GapAnalysis, LearningPath, InterviewFeedback, InterviewPhase, SourceRef, OdysseyLife, OdysseyLifeType, OdysseyDashboard } from './session-store';
```

Append to the bottom of the file:

```ts
const LIFE_LABELS: Record<OdysseyLifeType, { index: number; fallback: string }> = {
  current: { index: 1, fallback: 'Current Path' },
  pivot: { index: 2, fallback: 'The Pivot' },
  wildcard: { index: 3, fallback: 'The Wildcard' },
};

const DASHBOARD_ROWS: { field: keyof OdysseyDashboard; label: string; question: string }[] = [
  { field: 'resources', label: 'Resources', question: 'do I have what I\'d need to make this happen?' },
  { field: 'likability', label: 'Likability', question: 'do I actually like the sound of this?' },
  { field: 'confidence', label: 'Confidence', question: 'am I confident I could make it work?' },
  { field: 'coherence', label: 'Coherence', question: 'does it fit who I\'m becoming?' },
];

function renderDashboard(d: OdysseyDashboard): string[] {
  const lines = ['### How does this feel?'];
  for (const row of DASHBOARD_ROWS) {
    const value = d[row.field];
    if (value === null) {
      lines.push(`- **${row.label}:** — not yet rated`);
    } else {
      lines.push(`- **${row.label}:** ${value}/5 — ${row.question}`);
    }
  }
  return lines;
}

function renderLife(life: OdysseyLife): string[] {
  const { index, fallback } = LIFE_LABELS[life.type];
  const label = life.label.trim() || fallback;
  const lines: string[] = [];
  lines.push(`## Life ${index} — ${fallback}: ${label}`);
  lines.push('');

  if (!life.headline && !life.dayInTheLife) {
    // Unelaborated
    if (life.seed.trim()) {
      lines.push(`**Seed:** ${life.seed.trim()}`);
      lines.push('');
    }
    lines.push('*(This life has not been elaborated yet.)*');
    lines.push('');
    lines.push(...renderDashboard(life.dashboard));
    lines.push('');
    return lines;
  }

  if (life.headline) {
    lines.push(`**${life.headline}**`);
    lines.push('');
  }
  if (life.dayInTheLife) {
    lines.push('### A day in 2030');
    lines.push(life.dayInTheLife);
    lines.push('');
  }
  if (life.typicalWeek.length > 0) {
    lines.push('### Typical week');
    for (const w of life.typicalWeek) lines.push(`- ${w}`);
    lines.push('');
  }
  if (life.toolsAndSkills.length > 0) {
    lines.push('### Tools & skills');
    for (const t of life.toolsAndSkills) lines.push(`- ${t}`);
    lines.push('');
  }
  if (life.whoYouWorkWith) {
    lines.push('### Who you work with');
    lines.push(life.whoYouWorkWith);
    lines.push('');
  }
  if (life.challenges.length > 0) {
    lines.push('### Challenges');
    for (const c of life.challenges) lines.push(`- ${c}`);
    lines.push('');
  }
  if (life.questionsToExplore.length > 0) {
    lines.push('### Questions to explore');
    for (const q of life.questionsToExplore) lines.push(`- ${q}`);
    lines.push('');
  }
  lines.push(...renderDashboard(life.dashboard));
  lines.push('');
  return lines;
}

export function odysseyPlanToMarkdown(lives: Record<OdysseyLifeType, OdysseyLife>): string {
  const lines: string[] = [];
  lines.push('# Odyssey Plan: Three Alternative Lives');
  lines.push('');

  const order: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];
  order.forEach((type, idx) => {
    lines.push(...renderLife(lives[type]));
    if (idx < order.length - 1) {
      lines.push('---');
      lines.push('');
    }
  });

  lines.push('---');
  lines.push('');
  lines.push('*AI-generated elaboration. Dashboard ratings are your own reflection.*');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/markdown-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "feat(export): add odysseyPlanToMarkdown with dashboard and placeholders"
```

---

## Task 5: `app/api/odysseySuggest/route.ts` — seed suggestion API

**Files:**
- Create: `app/api/odysseySuggest/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildSeedSuggestionPrompt, parseSeedSuggestion, type SeedSuggestionInput } from '@/lib/prompts/odyssey-suggest';

interface OdysseySuggestRequest extends SeedSuggestionInput {
  llmConfig?: LLMConfig;
}

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as OdysseySuggestRequest;

    if (!input.type || !['current', 'pivot', 'wildcard'].includes(input.type)) {
      return new Response(
        JSON.stringify({ error: 'A valid life type is required.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    const raw = await provider.createCompletion(
      [
        { role: 'system', content: 'You propose concise, first-person life seeds for an Odyssey Plan exercise. You ONLY respond in JSON.' },
        { role: 'user', content: buildSeedSuggestionPrompt(input) },
      ],
      llmConfig
    );

    const suggestion = parseSeedSuggestion(raw);
    return new Response(JSON.stringify(suggestion), { status: 200 });
  } catch (error) {
    console.error('[odysseySuggest] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/odysseySuggest/route.ts
git commit -m "feat(api): add /api/odysseySuggest for per-life seed suggestions"
```

---

## Task 6: `app/api/odysseyElaborate/route.ts` — elaborate API with trim-retry

**Files:**
- Create: `app/api/odysseyElaborate/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildOdysseyElaboratePrompt, parseOdysseyElaboration, type OdysseyElaborateInput } from '@/lib/prompts/odyssey';
import { isTokenLimitError } from '@/lib/token-limit';

interface OdysseyElaborateRequest extends OdysseyElaborateInput {
  llmConfig?: LLMConfig;
}

const ADVERT_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimAdvert(input: OdysseyElaborateInput): OdysseyElaborateInput {
  if (input.jobAdvert && input.jobAdvert.length > ADVERT_TRIM_CHARS) {
    return { ...input, jobAdvert: input.jobAdvert.slice(0, ADVERT_TRIM_CHARS) };
  }
  return input;
}

function trimResume(input: OdysseyElaborateInput): OdysseyElaborateInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM = 'You are a career imagination assistant helping students picture alternative 5-year futures for an Odyssey Plan exercise. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as OdysseyElaborateRequest;

    if (!input.type || !['current', 'pivot', 'wildcard'].includes(input.type)) {
      return new Response(
        JSON.stringify({ error: 'A valid life type is required.' }),
        { status: 400 }
      );
    }
    if (!input.label || !input.label.trim()) {
      return new Response(
        JSON.stringify({ error: 'A label is required for this life.' }),
        { status: 400 }
      );
    }
    if (!input.seed || !input.seed.trim()) {
      return new Response(
        JSON.stringify({ error: 'A seed is required to elaborate this life.' }),
        { status: 400 }
      );
    }

    const llmConfig = clientConfig || (await getLLMConfig());
    const provider = getLLMProvider(llmConfig);

    let trimmed = false;
    let raw: string;
    let current = input;

    try {
      raw = await provider.createCompletion(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildOdysseyElaboratePrompt(current) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = trimAdvert(current);
      try {
        raw = await provider.createCompletion(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildOdysseyElaboratePrompt(current) },
          ],
          llmConfig
        );
      } catch (err2) {
        if (!isTokenLimitError(err2)) throw err2;
        current = trimResume(current);
        try {
          raw = await provider.createCompletion(
            [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: buildOdysseyElaboratePrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({ error: 'This life seed is too long to elaborate. Try a shorter description.' }),
            { status: 500 }
          );
        }
      }
    }

    const elaboration = parseOdysseyElaboration(raw);
    return new Response(JSON.stringify({ elaboration, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[odysseyElaborate] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/odysseyElaborate/route.ts
git commit -m "feat(api): add /api/odysseyElaborate with trim-retry on token limits"
```

---

## Task 7: `app/globals.css` — `editorial-rule.justify-center` modifier

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Find the existing `.editorial-rule` block**

Run: `grep -n "editorial-rule" app/globals.css` (use Grep tool).
Locate the existing rule definition.

- [ ] **Step 2: Add the modifier immediately after the existing rule**

Append these rules after the existing `.editorial-rule` block:

```css
.editorial-rule.justify-center {
  justify-content: center;
}

.editorial-rule.justify-center::after {
  content: '';
  width: 36px;
  height: 1px;
  background: hsl(var(--accent));
  flex-shrink: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style(editorial-rule): add justify-center modifier with mirrored right hairline"
```

---

## Task 8: `OdysseyDashboard` component — 4-dimension slider row

**Files:**
- Create: `components/odyssey/OdysseyDashboard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { OdysseyDashboard } from '@/lib/session-store';

type DashboardField = keyof OdysseyDashboard;

type Props = {
  dashboard: OdysseyDashboard;
  onChange?: (field: DashboardField, value: number | null) => void;
  readOnly?: boolean;
};

const ROWS: { field: DashboardField; label: string; tooltip: string }[] = [
  { field: 'resources', label: 'Resources', tooltip: 'Do I have what I\'d need to make this happen?' },
  { field: 'likability', label: 'Likability', tooltip: 'Do I actually like the sound of this?' },
  { field: 'confidence', label: 'Confidence', tooltip: 'Am I confident I could make it work?' },
  { field: 'coherence', label: 'Coherence', tooltip: 'Does it fit who I\'m becoming?' },
];

export default function OdysseyDashboard({ dashboard, onChange, readOnly = false }: Props) {
  function handleClick(field: DashboardField, value: number) {
    if (readOnly || !onChange) return;
    const current = dashboard[field];
    onChange(field, current === value ? null : value);
  }

  return (
    <div className='mt-6 pt-6 border-t border-border'>
      <div className='editorial-rule justify-center mb-4'>
        <span>How does this feel?</span>
      </div>
      <div className='space-y-3'>
        {ROWS.map((row) => {
          const value = dashboard[row.field];
          return (
            <div key={row.field} className='flex items-center gap-3' title={row.tooltip}>
              <div className='w-28 text-[var(--text-sm)] text-ink-muted'>{row.label}</div>
              <div className='flex gap-2'>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = value !== null && n <= value;
                  return (
                    <button
                      key={n}
                      type='button'
                      disabled={readOnly}
                      onClick={() => handleClick(row.field, n)}
                      aria-label={`${row.label}: ${n} of 5`}
                      className={`w-4 h-4 rounded-full border transition-colors duration-[200ms] ${
                        filled ? 'bg-accent border-accent' : 'bg-transparent border-ink-quiet'
                      } ${readOnly ? 'cursor-default' : 'cursor-pointer hover:border-accent'}`}
                    />
                  );
                })}
              </div>
              <div className='text-[var(--text-xs)] text-ink-quiet italic flex-1'>{row.tooltip}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/odyssey/OdysseyDashboard.tsx
git commit -m "feat(odyssey): add OdysseyDashboard 4-dimension rating row"
```

---

## Task 9: `OdysseyElaboration` component — shared read-only render

**Files:**
- Create: `components/odyssey/OdysseyElaboration.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { OdysseyLife } from '@/lib/session-store';

type Props = {
  life: OdysseyLife;
};

export default function OdysseyElaboration({ life }: Props) {
  if (!life.headline && !life.dayInTheLife) return null;
  return (
    <div className='mt-6 space-y-6 text-ink'>
      {life.headline && (
        <p className='text-[var(--text-lg)] font-semibold italic text-ink'>
          {life.headline}
        </p>
      )}

      {life.dayInTheLife && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>A day in 2030</h3>
          <p className='text-ink-muted leading-relaxed'>{life.dayInTheLife}</p>
        </div>
      )}

      {life.typicalWeek.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Typical week</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.typicalWeek.map((w, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {life.toolsAndSkills.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Tools &amp; skills</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.toolsAndSkills.map((t, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {life.whoYouWorkWith && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Who you work with</h3>
          <p className='text-ink-muted leading-relaxed'>{life.whoYouWorkWith}</p>
        </div>
      )}

      {life.challenges.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Challenges</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.challenges.map((c, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {life.questionsToExplore.length > 0 && (
        <div>
          <h3 className='text-[var(--text-base)] font-semibold text-ink mb-2'>Questions to explore</h3>
          <ul className='space-y-1 text-ink-muted'>
            {life.questionsToExplore.map((q, i) => (
              <li key={i} className='flex gap-2'>
                <span className='text-accent flex-shrink-0'>·</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/odyssey/OdysseyElaboration.tsx
git commit -m "feat(odyssey): add OdysseyElaboration shared read-only render"
```

---

## Task 10: `OdysseyLifeCard` — per-life editable card with actions

**Files:**
- Create: `components/odyssey/OdysseyLifeCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type OdysseyLife, type OdysseyLifeType } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';
import OdysseyElaboration from './OdysseyElaboration';
import OdysseyDashboard from './OdysseyDashboard';

const TITLES: Record<OdysseyLifeType, string> = {
  current: 'Life 1 — Current Path',
  pivot: 'Life 2 — The Pivot',
  wildcard: 'Life 3 — The Wildcard',
};

type Props = { type: OdysseyLifeType };

export default function OdysseyLifeCard({ type }: Props) {
  const router = useRouter();
  const store = useSessionStore();
  const life = store.odysseyLives[type];
  const [elaborating, setElaborating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const isElaborated = !!life.headline;

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return false;
    }
    return true;
  }

  function profilePayload() {
    return {
      resume: store.resumeText ?? undefined,
      freeText: store.freeText || undefined,
      jobTitle: store.jobTitle || undefined,
      jobAdvert: store.jobAdvert || undefined,
      distilledProfile: store.distilledProfile ?? undefined,
    };
  }

  async function runElaborate() {
    if (!life.seed.trim()) return;
    if (!(await ensureProvider())) return;

    setElaborating(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/odysseyElaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          label: life.label.trim() || TITLES[type],
          seed: life.seed.trim(),
          ...profilePayload(),
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not elaborate this life.');
      }
      const { elaboration } = await res.json();
      store.setOdysseyElaboration(type, elaboration);
      if (elaboration.trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not elaborate this life. Try again.');
    } finally {
      setElaborating(false);
    }
  }

  async function runSuggest() {
    if (!(await ensureProvider())) return;

    const hasContent = life.label.trim() || life.seed.trim();
    if (hasContent && !confirm('Replace your current seed with a suggestion?')) {
      return;
    }

    setSuggesting(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/odysseySuggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...profilePayload(), llmConfig }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not generate a suggestion.');
      }
      const { label, description } = await res.json();
      store.setOdysseySeed(type, label, description);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not generate a suggestion. Try again or type one yourself.');
    } finally {
      setSuggesting(false);
    }
  }

  async function runRegenerate() {
    if (!confirm('Regenerate this life? The current elaboration will be replaced. Your dashboard ratings will be kept.')) {
      return;
    }
    await runElaborate();
  }

  function runReset() {
    if (!confirm('Reset this life? This clears the seed, elaboration, and ratings.')) return;
    store.resetOdysseyLife(type);
  }

  return (
    <div className='border border-border rounded-lg bg-paper p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-[var(--text-xl)] font-semibold text-ink'>{TITLES[type]}</h2>
        {isElaborated && (
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={runRegenerate} disabled={elaborating || suggesting}>
              <RotateCcw className='w-3 h-3 mr-1' />
              {elaborating ? 'Regenerating…' : 'Regenerate'}
            </Button>
            <Button variant='outline' size='sm' onClick={runReset} disabled={elaborating || suggesting}>
              <Trash2 className='w-3 h-3 mr-1' />
              Reset
            </Button>
          </div>
        )}
      </div>

      <div className='space-y-3'>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>Label</label>
          <Input
            value={life.label}
            onChange={(e) => store.setOdysseySeed(type, e.target.value, life.seed)}
            placeholder='A short name for this life (3-8 words)'
            disabled={elaborating || suggesting}
          />
        </div>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>Seed</label>
          <Textarea
            value={life.seed}
            rows={3}
            onChange={(e) => store.setOdysseySeed(type, life.label, e.target.value)}
            placeholder='One or two sentences about this life, written in first person.'
            disabled={elaborating || suggesting}
          />
        </div>
      </div>

      {!isElaborated && (
        <div className='flex gap-3 mt-4'>
          <Button onClick={runElaborate} disabled={!life.seed.trim() || elaborating || suggesting}>
            {elaborating ? <><LoadingDots color='white' /> Elaborating…</> : 'Elaborate this life'}
          </Button>
          <Button variant='outline' onClick={runSuggest} disabled={elaborating || suggesting}>
            <Sparkles className='w-4 h-4 mr-2' />
            {suggesting ? 'Thinking…' : 'Suggest from profile'}
          </Button>
        </div>
      )}

      {isElaborated && (
        <>
          <OdysseyElaboration life={life} />
          <OdysseyDashboard
            dashboard={life.dashboard}
            onChange={(field, value) => store.setOdysseyDashboard(type, field, value)}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/odyssey/OdysseyLifeCard.tsx
git commit -m "feat(odyssey): add OdysseyLifeCard with elaborate/suggest/regenerate/reset"
```

---

## Task 11: `OdysseyCompareView` — three-column side-by-side

**Files:**
- Create: `components/odyssey/OdysseyCompareView.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { OdysseyLife, OdysseyLifeType } from '@/lib/session-store';
import OdysseyElaboration from './OdysseyElaboration';
import OdysseyDashboard from './OdysseyDashboard';

const TITLES: Record<OdysseyLifeType, string> = {
  current: 'Life 1 — Current Path',
  pivot: 'Life 2 — The Pivot',
  wildcard: 'Life 3 — The Wildcard',
};

type Props = {
  lives: Record<OdysseyLifeType, OdysseyLife>;
};

export default function OdysseyCompareView({ lives }: Props) {
  const order: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
      {order.map((type) => {
        const life = lives[type];
        const isElaborated = !!life.headline;
        return (
          <div key={type} className='border border-border rounded-lg bg-paper p-5'>
            <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-1'>
              {TITLES[type]}
            </h2>
            {life.label.trim() && (
              <p className='text-[var(--text-sm)] text-ink-muted mb-3'>{life.label}</p>
            )}
            {isElaborated ? (
              <>
                <OdysseyElaboration life={life} />
                <OdysseyDashboard dashboard={life.dashboard} readOnly />
              </>
            ) : (
              <p className='text-[var(--text-sm)] text-ink-quiet italic mt-4'>
                {TITLES[type]} is not yet elaborated. Return to the cards to fill this in.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/odyssey/OdysseyCompareView.tsx
git commit -m "feat(odyssey): add OdysseyCompareView three-column side-by-side"
```

---

## Task 12: `app/odyssey/page.tsx` — orchestrator page

**Files:**
- Create: `app/odyssey/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import OdysseyLifeCard from '@/components/odyssey/OdysseyLifeCard';
import OdysseyCompareView from '@/components/odyssey/OdysseyCompareView';
import { useSessionStore, type OdysseyLifeType } from '@/lib/session-store';
import { odysseyPlanToMarkdown } from '@/lib/markdown-export';

const TYPES: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];

export default function OdysseyPage() {
  const router = useRouter();
  const store = useSessionStore();
  const { odysseyLives } = store;
  const [view, setView] = useState<'cards' | 'compare'>('cards');

  const elaboratedCount = TYPES.filter((t) => !!odysseyLives[t].headline).length;
  const canCompare = elaboratedCount >= 2;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  const markdown = odysseyPlanToMarkdown(odysseyLives);

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            <CopyMarkdownButton text={markdown} label='Copy as Markdown' />
            {view === 'cards' ? (
              <Button
                variant='outline'
                onClick={() => setView('compare')}
                disabled={!canCompare}
                title={canCompare ? 'Compare all three lives' : 'Elaborate at least two lives first'}
              >
                <Columns3 className='w-4 h-4 mr-2' />
                Compare all three
              </Button>
            ) : (
              <Button variant='outline' onClick={() => setView('cards')}>
                <ArrowLeft className='w-4 h-4 mr-2' />
                Back to cards
              </Button>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        <div className='editorial-rule justify-center mb-2'>
          <span>Odyssey Plan</span>
        </div>
        <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
          Imagine three lives
        </h1>
        <p className='text-[var(--text-base)] text-ink-muted text-center max-w-2xl mx-auto mb-8'>
          Three alternative five-year futures. Brainstorm each seed, let the AI flesh it out,
          then rate how each one feels. There are no wrong answers.
        </p>

        {view === 'cards' ? (
          <div className='space-y-6'>
            {TYPES.map((type) => (
              <OdysseyLifeCard key={type} type={type} />
            ))}
          </div>
        ) : (
          <OdysseyCompareView lives={odysseyLives} />
        )}
      </div>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 2: Verify the page type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/odyssey/page.tsx
git commit -m "feat(odyssey): add /odyssey orchestrator page with card and compare views"
```

---

## Task 13: `ActionsZone` — regroup into Discover / Assess / Reflect + Odyssey button

**Files:**
- Modify: `components/landing/ActionsZone.tsx`

- [ ] **Step 1: Add the Odyssey handler and button to ActionsZone**

Add `Sparkles` to the lucide import at the top:

```ts
import { Compass, MessageCircle, SearchCheck, Route as RouteIcon, Mic, Sparkles } from 'lucide-react';
```

Add a new handler inside the component, after `handleInterview`:

```ts
  async function handleOdyssey() {
    clearMissingHints();
    if (!(await ensureProvider())) return;
    router.push('/odyssey');
  }
```

Replace the entire `return (...)` block with the grouped layout:

```tsx
  return (
    <div className='w-full max-w-5xl mt-6 space-y-8'>
      <section>
        <div className='editorial-rule justify-center mb-3'>
          <span>Discover</span>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <Button onClick={handleFindCareers} disabled={anyRunning} className='py-6'>
            <Compass className='w-4 h-4 mr-2' />
            Find my careers
          </Button>
          <Button onClick={handleStartChatting} disabled={anyRunning} variant='outline' className='py-6'>
            <MessageCircle className='w-4 h-4 mr-2' />
            Start chatting
          </Button>
        </div>
      </section>

      <section>
        <div className='editorial-rule justify-center mb-3'>
          <span>Assess</span>
        </div>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <Button onClick={handleGapAnalysis} disabled={anyRunning} variant='outline' className='py-6'>
            <SearchCheck className='w-4 h-4 mr-2' />
            {running === 'gaps' ? 'Analysing…' : 'Gap analysis'}
          </Button>
          <Button onClick={handleLearningPath} disabled={anyRunning} variant='outline' className='py-6'>
            <RouteIcon className='w-4 h-4 mr-2' />
            {running === 'learn' ? 'Building…' : 'Learning path'}
          </Button>
          <Button onClick={handleInterview} disabled={anyRunning} variant='outline' className='py-6'>
            <Mic className='w-4 h-4 mr-2' />
            Practice interview
          </Button>
        </div>
      </section>

      <section>
        <div className='editorial-rule justify-center mb-3'>
          <span>Reflect</span>
        </div>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <Button onClick={handleOdyssey} disabled={anyRunning} variant='outline' className='py-6'>
            <Sparkles className='w-4 h-4 mr-2' />
            Imagine three lives
          </Button>
        </div>
      </section>
    </div>
  );
```

- [ ] **Step 2: Verify it type-checks and existing 5 actions still work**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual sanity check (during subsequent QA task): landing page renders three labelled groups, all 6 buttons navigate or fire as expected.

- [ ] **Step 3: Commit**

```bash
git add components/landing/ActionsZone.tsx
git commit -m "feat(landing): regroup ActionsZone into Discover/Assess/Reflect, add Odyssey"
```

---

## Task 14: `OutputsBanner` — odyssey-in-progress link

**Files:**
- Modify: `components/landing/OutputsBanner.tsx`

- [ ] **Step 1: Add odyssey detection and link**

In `OutputsBanner.tsx`, destructure `odysseyLives` alongside the existing fields:

```ts
  const {
    chatMessages,
    careers,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
    odysseyLives,
  } = store;
```

Add detection after `hasInterviewInProgress`:

```ts
  const hasOdyssey = Object.values(odysseyLives).some(
    (life) => life.seed.trim() || life.headline
  );
```

Add `!hasOdyssey` to the null-return guard:

```ts
  if (
    !hasCareers &&
    !hasChat &&
    !hasGap &&
    !hasPath &&
    !hasInterviewInProgress &&
    !hasInterviewFeedback &&
    !hasOdyssey
  ) return null;
```

Add the link inside the flex row, after the interview feedback link:

```tsx
        {hasOdyssey && (
          <Link href='/odyssey' className='underline hover:text-accent'>
            odyssey plan in progress
          </Link>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/OutputsBanner.tsx
git commit -m "feat(landing): add odyssey plan quick-jump link to OutputsBanner"
```

---

## Task 15: `ChatComposer` — optional `onOdyssey` chain button

**Files:**
- Modify: `components/chat/ChatComposer.tsx`

- [ ] **Step 1: Inspect the current ChatComposer**

Read `components/chat/ChatComposer.tsx` to find the prop shape and where the existing chain buttons (`onCareerGen`, `onGap`, `onLearningPath`) render.

- [ ] **Step 2: Add `onOdyssey` prop alongside the existing chain handlers**

Add to the `Props` type:

```ts
  onOdyssey?: () => void;
  odysseyDisabled?: boolean;
```

In the chain-button row, add a new button styled consistently with the existing chain buttons. Example (adapt to the existing button pattern):

```tsx
      {onOdyssey && (
        <button
          type='button'
          onClick={onOdyssey}
          disabled={odysseyDisabled}
          className='text-[var(--text-sm)] text-ink-muted hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed'
        >
          Try as Odyssey plan →
        </button>
      )}
```

Place it adjacent to the other chain buttons following the same conditional render pattern already in the file.

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatComposer.tsx
git commit -m "feat(chat): add optional onOdyssey chain button to ChatComposer"
```

---

## Task 16: `app/chat/page.tsx` — `handleOdyssey` handler

**Files:**
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Inspect the current chat page to locate existing chain handlers**

Read `app/chat/page.tsx` to locate the pattern used by `handleCareerGen` / `handleGap` / `handleLearningPath` and the ChatComposer render site.

- [ ] **Step 2: Add `handleOdyssey`**

Add near the other chain handlers:

```ts
  async function handleOdyssey() {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }
    setDistilling(true);
    try {
      const llmConfig = await loadLLMConfig();
      const res = await fetch('/api/distillProfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: useSessionStore.getState().chatMessages,
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          jobTitle: store.jobTitle || undefined,
          guidance:
            'Produce a one-to-two sentence aspirational summary suitable as the opening seed for a "Current Path" life in an Odyssey Plan — what the student seems to be heading toward based on this conversation. Write it in first person. Put this in the "background" field.',
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not distil the chat');
      }
      const { profile } = (await res.json()) as { profile: StudentProfile };
      const seedText = profile.background || '';
      const seedLabel = (profile.goals[0] ?? 'Current path').slice(0, 60);
      store.setOdysseySeed('current', seedLabel, seedText);
      router.push('/odyssey');
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Could not set up Odyssey plan from this chat.'
      );
    } finally {
      setDistilling(false);
    }
  }
```

Ensure `StudentProfile` is imported from `@/lib/session-store`.

- [ ] **Step 3: Wire `onOdyssey` into ChatComposer**

At the ChatComposer render site, pass the new props. The disabled threshold matches existing chain gating (adapt to whatever `userMessageCount` variable already exists):

```tsx
        onOdyssey={handleOdyssey}
        odysseyDisabled={distilling || userMessageCount < 3}
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat(chat): add Odyssey chain handler reusing distillProfile with guidance"
```

---

## Task 17: Manual QA and full test suite

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npx vitest run`
Expected: PASS — all existing tests plus new odyssey tests (session store, odyssey prompts, odyssey-suggest prompts, markdown export).

- [ ] **Step 2: Start the app in Electron dev mode**

Run: `npm run electron:dev`

- [ ] **Step 3: Walk the manual QA checklist from the spec**

Go through every bullet in `docs/superpowers/specs/2026-04-15-f11-odyssey-plan-design.md` under "Manual QA checklist". For each item, verify the behaviour. Items to specifically hit:

- Landing shows ActionsZone in three labelled groups (Discover / Assess / Reflect)
- Existing 5 buttons in their correct groups and still functional
- "Imagine three lives" navigates to `/odyssey`
- Life 1 elaborate → card expands, empty dashboard
- Dashboard dot click → persists; click same dot → clears to null
- Regenerate → confirm → new elaboration, dashboard ratings preserved
- Reset → confirm → card fully empty including dashboard
- Suggest on empty card → fills seed
- Suggest on non-empty → confirmation before overwrite
- Suggest with zero profile → honest acknowledgement in description
- Elaborate all three → Compare all three enabled
- Compare view → three columns, read-only dashboards, no click effect
- Compare view with 2 elaborated → third column shows placeholder
- Copy as Markdown from both views → identical output
- Start over → confirms → all three lives cleared
- Chat chain button enabled after 3 user messages
- Chat chain → distils → /odyssey with Life 1 pre-filled from chat
- OutputsBanner shows "odyssey plan in progress" when any life has seed or elaboration
- Navigate away and return → state preserved
- Force parse error (by using a toy provider if possible) → toast, card stays editable
- No LLM provider configured → pre-flight redirect from elaborate and suggest

- [ ] **Step 4: Document any QA findings**

If any behaviour is wrong, open specific follow-up fix tasks. Do not mark the plan complete until QA passes.

- [ ] **Step 5: Final commit if QA-only fixes are needed**

If QA surfaced small fixes, commit them:

```bash
git add -A
git commit -m "fix(odyssey): QA corrections"
```

---

## Notes for the implementer

- **No grounding for Odyssey.** Do not wire search into elaborate or suggest. This is imagination work.
- **Studio Calm tokens only.** Use `bg-paper`, `border-border`, `text-ink`, `text-ink-muted`, `text-ink-quiet`, `bg-accent-soft`, `text-accent` consistently. No raw hex colours.
- **Session state is in-memory only.** Do not add persistence. `reset()` already clears odyssey slots via `set({ ...initialState })`.
- **Trim-retry chain** for elaborate: first trim `jobAdvert`, then trim `resume`, then honest 500. Mirrors gap analysis.
- **Suggest has no trim-retry.** The prompt is small.
- **Chat chain only pre-fills Life 1.** Pedagogical integrity — Life 2 and Life 3 are the student's own reflection.
- **Dashboard is student-filled.** The LLM never rates it.
- **Em dashes:** user preference is to avoid them in UI text (the existing codebase uses periods, colons, or " - "). Keep the spec-style em dash in section headers and decorative contexts only (the editorial-rule divider, file-level headings); use plain punctuation in body UI copy.
- **Reuse `CopyMarkdownButton`** with `text={markdown}` prop — do not build a new copy component.
- **Follow existing prompt-builder style** (gaps.ts, learningPath.ts) for the tone and structure of the odyssey prompts.
