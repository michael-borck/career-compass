# F10 Career Path Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship side-by-side comparison of 2 or 3 career paths across seven fixed dimensions, with two entry points (landing "Compare careers" for quick mode, `/careers` spider-graph multi-select for rich mode) producing one destination `/compare` page.

**Architecture:** One shared LLM endpoint + prompt + parser handles both modes — rich mode passes existing `finalCareerInfo` as additional context. New `/compare` route renders an input card (quick mode) or jumps straight to the result view (rich mode). `/careers` gets a toggle button per card and a top banner that builds the comparison list, using a new `comparing: string[]` live-selection state in the session store.

**Tech Stack:** Next.js 14 App Router, Zustand session store, Vitest for pure-function tests, Studio Calm design tokens, `react-hot-toast`, `lucide-react` icons (`Columns3`, `X`).

**Spec:** `docs/superpowers/specs/2026-04-16-f10-career-comparison-design.md` — canonical source.

---

## File Structure

**New files:**
- `lib/prompts/compare.ts` — prompt builder + parser
- `lib/prompts/compare.test.ts`
- `app/api/compare/route.ts`
- `app/compare/page.tsx`
- `components/compare/CompareInputCard.tsx`
- `components/compare/CompareTable.tsx`

**Modified files:**
- `lib/session-store.ts` — new types, fields, actions
- `lib/session-store.test.ts` — extended tests
- `lib/markdown-export.ts` — add `comparisonToMarkdown`
- `lib/markdown-export.test.ts` — extended tests
- `components/landing/ActionsZone.tsx` — add "Compare careers" button to Discover group, `handleCompare` with gate
- `components/landing/ActionWillUse.tsx` — add `'compare'` case
- `components/landing/OutputsBanner.tsx` — comparison quick-jump link
- `components/CareerNode.tsx` — "Compare this role" / "Remove from comparison" toggle + ring
- `app/careers/page.tsx` — top banner reading `comparing` from store

---

## Task 1: Session store — Comparison types, state, actions

**Files:**
- Modify: `lib/session-store.ts`
- Modify: `lib/session-store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/session-store.test.ts`:

```ts
describe('comparison', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('comparison, comparePrefill, and comparing initialise', () => {
    const s = useSessionStore.getState();
    expect(s.comparison).toBeNull();
    expect(s.comparePrefill).toBeNull();
    expect(s.comparing).toEqual([]);
  });

  it('setComparison writes and clears', () => {
    const comparison = {
      mode: 'quick' as const,
      roles: [
        {
          label: 'Data analyst',
          cells: {
            typicalDay: 'a', coreSkills: 'b', trainingNeeded: 'c',
            salaryRange: 'd', workSetting: 'e', whoItSuits: 'f', mainChallenge: 'g',
          },
        },
        {
          label: 'UX researcher',
          cells: {
            typicalDay: 'h', coreSkills: 'i', trainingNeeded: 'j',
            salaryRange: 'k', workSetting: 'l', whoItSuits: 'm', mainChallenge: 'n',
          },
        },
      ],
    };
    useSessionStore.getState().setComparison(comparison);
    expect(useSessionStore.getState().comparison).toEqual(comparison);
    useSessionStore.getState().setComparison(null);
    expect(useSessionStore.getState().comparison).toBeNull();
  });

  it('setComparePrefill and consumeComparePrefill are atomic', () => {
    useSessionStore.getState().setComparePrefill({ seedTarget: 'Data analyst' });
    const first = useSessionStore.getState().consumeComparePrefill();
    expect(first).toEqual({ seedTarget: 'Data analyst' });
    expect(useSessionStore.getState().consumeComparePrefill()).toBeNull();
    expect(useSessionStore.getState().comparePrefill).toBeNull();
  });

  it('toggleComparing adds a title when absent', () => {
    useSessionStore.getState().toggleComparing('Data analyst');
    expect(useSessionStore.getState().comparing).toEqual(['Data analyst']);
  });

  it('toggleComparing removes a title when present', () => {
    useSessionStore.getState().toggleComparing('Data analyst');
    useSessionStore.getState().toggleComparing('UX researcher');
    useSessionStore.getState().toggleComparing('Data analyst');
    expect(useSessionStore.getState().comparing).toEqual(['UX researcher']);
  });

  it('toggleComparing silently no-ops when already at 3', () => {
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().toggleComparing('B');
    useSessionStore.getState().toggleComparing('C');
    useSessionStore.getState().toggleComparing('D');
    expect(useSessionStore.getState().comparing).toEqual(['A', 'B', 'C']);
  });

  it('clearComparing empties the list', () => {
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().toggleComparing('B');
    useSessionStore.getState().clearComparing();
    expect(useSessionStore.getState().comparing).toEqual([]);
  });

  it('reset() clears comparison, comparePrefill, and comparing', () => {
    useSessionStore.getState().setComparison({
      mode: 'quick',
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
        { label: 'B', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    useSessionStore.getState().setComparePrefill({ seedTarget: 'X' });
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.comparison).toBeNull();
    expect(s.comparePrefill).toBeNull();
    expect(s.comparing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/session-store.test.ts`
Expected: FAIL — `comparison`, `toggleComparing`, etc. do not exist.

- [ ] **Step 3: Modify `lib/session-store.ts`**

Add these types above `SessionState`:

```ts
export type ComparisonDimension =
  | 'typicalDay'
  | 'coreSkills'
  | 'trainingNeeded'
  | 'salaryRange'
  | 'workSetting'
  | 'whoItSuits'
  | 'mainChallenge';

export type ComparisonRole = {
  label: string;
  cells: Record<ComparisonDimension, string>;
};

export type Comparison = {
  mode: 'quick' | 'rich';
  roles: ComparisonRole[];
};

export type ComparePrefill = {
  seedTarget?: string;
  richCareerTitles?: string[];
};
```

Add to `SessionState`:

```ts
  // Comparison
  comparison: Comparison | null;
  comparePrefill: ComparePrefill | null;
  comparing: string[];
```

Add to the actions section of `SessionState`:

```ts
  setComparison: (c: Comparison | null) => void;
  setComparePrefill: (p: ComparePrefill | null) => void;
  consumeComparePrefill: () => ComparePrefill | null;
  toggleComparing: (careerTitle: string) => void;
  clearComparing: () => void;
```

Add to `initialState`:

```ts
  comparison: null,
  comparePrefill: null,
  comparing: [],
```

Add action implementations inside the `create<SessionState>((set, get) => ({...}))` factory:

```ts
  setComparison: (c) => set({ comparison: c }),
  setComparePrefill: (p) => set({ comparePrefill: p }),
  consumeComparePrefill: () => {
    const current = get().comparePrefill;
    if (current) set({ comparePrefill: null });
    return current;
  },
  toggleComparing: (title) =>
    set((state) => {
      if (state.comparing.includes(title)) {
        return { comparing: state.comparing.filter((t) => t !== title) };
      }
      if (state.comparing.length >= 3) {
        return state;
      }
      return { comparing: [...state.comparing, title] };
    }),
  clearComparing: () => set({ comparing: [] }),
```

`reset()` already clears these automatically via `set({ ...initialState })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/session-store.test.ts`
Expected: PASS — all new comparison tests plus all existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/session-store.ts lib/session-store.test.ts
git commit -m "feat(session): add Comparison types, comparing live-selection, and actions"
```

---

## Task 2: `lib/prompts/compare.ts` — prompt builder and parser

**Files:**
- Create: `lib/prompts/compare.ts`
- Create: `lib/prompts/compare.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/prompts/compare.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildComparePrompt, parseComparison, type CompareInput } from './compare';
import type { finalCareerInfo } from '@/lib/types';

const baseQuick: CompareInput = {
  mode: 'quick',
  targets: [
    { label: 'Data analyst' },
    { label: 'UX researcher' },
  ],
};

const richCareer: finalCareerInfo = {
  jobTitle: 'Data analyst',
  jobDescription: 'Turns raw data into useful findings.',
  timeline: '3-6 months',
  salary: '$75-95k AUD',
  difficulty: 'Medium',
  workRequired: 'SQL, Python basics, Tableau.',
  aboutTheRole: 'Works with small research teams on survey data.',
  whyItsagoodfit: ['Likes numbers'],
  roadmap: [{ step1: 'Learn SQL' }],
};

describe('buildComparePrompt', () => {
  it('includes all target labels', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).toContain('Data analyst');
    expect(out).toContain('UX researcher');
  });

  it('asks for the seven-dimension cells shape', () => {
    const out = buildComparePrompt(baseQuick);
    for (const dim of ['typicalDay', 'coreSkills', 'trainingNeeded', 'salaryRange', 'workSetting', 'whoItSuits', 'mainChallenge']) {
      expect(out).toContain(`"${dim}"`);
    }
  });

  it('asks for roles as a JSON array', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).toMatch(/"roles"/);
    expect(out).toMatch(/"label"/);
    expect(out).toMatch(/"cells"/);
  });

  it('quick mode does not embed finalCareerInfo context', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).not.toContain('Existing career data');
  });

  it('rich mode embeds finalCareerInfo context for each target', () => {
    const out = buildComparePrompt({
      mode: 'rich',
      targets: [
        { label: 'Data analyst', context: richCareer },
        { label: 'UX researcher', context: { ...richCareer, jobTitle: 'UX researcher', jobDescription: 'Studies users.' } },
      ],
    });
    expect(out).toContain('Existing career data');
    expect(out).toContain('$75-95k AUD');
    expect(out).toContain('Studies users.');
  });

  it('includes profile when provided', () => {
    const out = buildComparePrompt({
      ...baseQuick,
      resume: 'Third-year public health student at Curtin.',
    });
    expect(out).toContain('Curtin');
  });

  it('includes distilled profile when provided', () => {
    const out = buildComparePrompt({
      ...baseQuick,
      distilledProfile: {
        background: 'Nursing undergrad',
        interests: ['health data'],
        skills: ['statistics'],
        constraints: [],
        goals: ['policy work'],
      },
    });
    expect(out).toMatch(/nursing undergrad/i);
  });

  it('omits profile section when no profile fields provided', () => {
    const out = buildComparePrompt(baseQuick);
    expect(out).not.toContain('<profile>');
  });

  it('handles three targets', () => {
    const out = buildComparePrompt({
      mode: 'quick',
      targets: [
        { label: 'Data analyst' },
        { label: 'UX researcher' },
        { label: 'Product manager' },
      ],
    });
    expect(out).toContain('Data analyst');
    expect(out).toContain('UX researcher');
    expect(out).toContain('Product manager');
  });
});

describe('parseComparison', () => {
  const happyPath = JSON.stringify({
    roles: [
      {
        label: 'Data analyst',
        cells: {
          typicalDay: 'Morning standup, then SQL.',
          coreSkills: 'SQL, Python, Tableau.',
          trainingNeeded: '3-6 months focused study.',
          salaryRange: '$75-95k AUD entry.',
          workSetting: 'Small teams, mostly solo analysis.',
          whoItSuits: 'People who like patterns.',
          mainChallenge: 'Cleaning bad data is tedious.',
        },
      },
      {
        label: 'UX researcher',
        cells: {
          typicalDay: 'Interviews and synthesis.',
          coreSkills: 'Interviewing, writing, empathy.',
          trainingNeeded: 'Portfolio of 3-5 studies.',
          salaryRange: '$70-90k AUD entry.',
          workSetting: 'Cross-functional product teams.',
          whoItSuits: 'People who love understanding others.',
          mainChallenge: 'Stakeholders ignore findings.',
        },
      },
    ],
  });

  it('parses happy path', () => {
    const out = parseComparison(happyPath, baseQuick);
    expect(out.mode).toBe('quick');
    expect(out.roles).toHaveLength(2);
    expect(out.roles[0].label).toBe('Data analyst');
    expect(out.roles[0].cells.typicalDay).toBe('Morning standup, then SQL.');
    expect(out.roles[1].cells.mainChallenge).toBe('Stakeholders ignore findings.');
  });

  it('strips markdown code fences', () => {
    const out = parseComparison('```json\n' + happyPath + '\n```', baseQuick);
    expect(out.roles).toHaveLength(2);
  });

  it('attaches mode from input', () => {
    const out = parseComparison(happyPath, { ...baseQuick, mode: 'rich' });
    expect(out.mode).toBe('rich');
  });

  it('throws when role count does not match input target count', () => {
    const single = JSON.stringify({
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    expect(() => parseComparison(single, baseQuick)).toThrow(/2/);
  });

  it('throws when a role has empty label', () => {
    const broken = JSON.stringify({
      roles: [
        { label: '', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
        { label: 'B', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    expect(() => parseComparison(broken, baseQuick)).toThrow(/label/i);
  });

  it('coerces missing cells to em-dash', () => {
    const missing = JSON.stringify({
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x' } },
        { label: 'B', cells: {} },
      ],
    });
    const out = parseComparison(missing, baseQuick);
    expect(out.roles[0].cells.mainChallenge).toBe('—');
    expect(out.roles[1].cells.typicalDay).toBe('—');
    expect(out.roles[1].cells.mainChallenge).toBe('—');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/prompts/compare.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/prompts/compare.ts`**

```ts
import type { StudentProfile, Comparison, ComparisonRole, ComparisonDimension } from '@/lib/session-store';
import type { finalCareerInfo } from '@/lib/types';

export type CompareMode = 'quick' | 'rich';

export type CompareTarget = {
  label: string;
  context?: finalCareerInfo;
};

export type CompareInput = {
  mode: CompareMode;
  targets: CompareTarget[];
  resume?: string;
  freeText?: string;
  distilledProfile?: StudentProfile;
};

const DIMENSIONS: ComparisonDimension[] = [
  'typicalDay',
  'coreSkills',
  'trainingNeeded',
  'salaryRange',
  'workSetting',
  'whoItSuits',
  'mainChallenge',
];

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildProfileSection(input: CompareInput): string | null {
  const parts: string[] = [];
  if (input.resume && input.resume.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText && input.freeText.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return null;
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

function formatCareerContext(c: finalCareerInfo): string {
  return [
    `Job title: ${c.jobTitle}`,
    `Description: ${c.jobDescription}`,
    `About the role: ${c.aboutTheRole}`,
    `Timeline: ${c.timeline}`,
    `Salary: ${c.salary}`,
    `Difficulty: ${c.difficulty}`,
    `Work required: ${c.workRequired}`,
    c.whyItsagoodfit.length > 0 ? `Why it fits: ${c.whyItsagoodfit.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTargetsSection(input: CompareInput): string {
  const blocks = input.targets.map((t, i) => {
    const lines = [`Target ${i + 1}: ${t.label}`];
    if (input.mode === 'rich' && t.context) {
      lines.push('Existing career data:');
      lines.push(formatCareerContext(t.context));
    }
    return lines.join('\n');
  });
  return `<targets>\n${blocks.join('\n\n')}\n</targets>`;
}

export function buildComparePrompt(input: CompareInput): string {
  const n = input.targets.length;
  const sections: string[] = [];

  sections.push(
    `You are helping a student compare ${n} possible career paths side-by-side. Produce a structured comparison across seven fixed dimensions so the student can scan and decide.`
  );

  sections.push(
    `Be specific and honest. Don't hedge. If one role pays more than another, say so. If one has a harder entry path, say so. Keep each cell short and scannable — 1-2 sentences, no more.`
  );

  sections.push(
    `Respond with JSON in EXACTLY this shape (no prose, no code fences):

{
  "roles": [
    {
      "label": string (the role title),
      "cells": {
        "typicalDay": string (1-2 sentences on what a typical day looks like),
        "coreSkills": string (1-2 sentences on the most important skills),
        "trainingNeeded": string (1-2 sentences on how someone gets into this),
        "salaryRange": string (1-2 sentences with a rough range and range-dependent caveats),
        "workSetting": string (1-2 sentences on team size, environment, autonomy),
        "whoItSuits": string (1-2 sentences on the kind of person who thrives),
        "mainChallenge": string (1-2 sentences on the honest downside)
      }
    }
  ]
}

The roles array must contain exactly ${n} entries in the same order as the targets below.`
  );

  if (input.mode === 'rich') {
    sections.push(
      `In rich mode, the comparison cells should be consistent with the existing career data shown for each target. Don't contradict the existing salary, timeline, or difficulty — use them as source of truth and frame the other cells consistently.`
    );
  }

  sections.push(buildTargetsSection(input));

  const profile = buildProfileSection(input);
  if (profile) sections.push(profile);

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

function coerceCells(raw: unknown): Record<ComparisonDimension, string> {
  const cells = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as Record<ComparisonDimension, string>;
  for (const dim of DIMENSIONS) {
    const value = cells[dim];
    out[dim] = typeof value === 'string' && value.trim() ? value.trim() : '—';
  }
  return out;
}

export function parseComparison(raw: string, input: CompareInput): Comparison {
  const parsed = JSON.parse(cleanJSON(raw));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('parseComparison: not an object');
  }
  if (!Array.isArray(parsed.roles)) {
    throw new Error('parseComparison: roles must be an array');
  }
  if (parsed.roles.length !== input.targets.length) {
    throw new Error(
      `parseComparison: expected ${input.targets.length} roles, got ${parsed.roles.length}`
    );
  }

  const roles: ComparisonRole[] = parsed.roles.map((r: any, i: number) => {
    if (!r || typeof r !== 'object') {
      throw new Error(`parseComparison: role ${i} is not an object`);
    }
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!label) {
      throw new Error(`parseComparison: role ${i} has empty label`);
    }
    return {
      label,
      cells: coerceCells(r.cells),
    };
  });

  return { mode: input.mode, roles };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/prompts/compare.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/compare.ts lib/prompts/compare.test.ts
git commit -m "feat(compare): add buildComparePrompt and parseComparison"
```

---

## Task 3: `lib/markdown-export.ts` — `comparisonToMarkdown`

**Files:**
- Modify: `lib/markdown-export.ts`
- Modify: `lib/markdown-export.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `lib/markdown-export.test.ts`:

```ts
import { comparisonToMarkdown } from './markdown-export';
import type { Comparison } from './session-store';

function makeComparison(mode: 'quick' | 'rich', roleCount: 2 | 3): Comparison {
  const roleLabels = ['Data analyst', 'UX researcher', 'Product manager'].slice(0, roleCount);
  return {
    mode,
    roles: roleLabels.map((label) => ({
      label,
      cells: {
        typicalDay: `${label} typical day`,
        coreSkills: `${label} core skills`,
        trainingNeeded: `${label} training`,
        salaryRange: `${label} salary`,
        workSetting: `${label} setting`,
        whoItSuits: `${label} suits`,
        mainChallenge: `${label} challenge`,
      },
    })),
  };
}

describe('comparisonToMarkdown', () => {
  it('renders quick mode header for 2 roles', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 2));
    expect(md).toContain('# Career Comparison');
    expect(md).toContain('Quick compare');
    expect(md).toContain('vague, makes assumptions');
    expect(md).toContain('1. Data analyst');
    expect(md).toContain('2. UX researcher');
    expect(md).not.toContain('3. Product manager');
  });

  it('renders rich mode header for 3 roles', () => {
    const md = comparisonToMarkdown(makeComparison('rich', 3));
    expect(md).toContain('Rich compare');
    expect(md).toContain('spider graph');
    expect(md).toContain('1. Data analyst');
    expect(md).toContain('3. Product manager');
  });

  it('renders all seven dimension sections', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 2));
    expect(md).toContain('### Typical day');
    expect(md).toContain('### Core skills');
    expect(md).toContain('### Training needed');
    expect(md).toContain('### Salary range');
    expect(md).toContain('### Work setting');
    expect(md).toContain('### Who it suits');
    expect(md).toContain('### Main challenge');
  });

  it('renders each role as a bullet under each dimension section', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 3));
    expect(md).toContain('- **Data analyst:** Data analyst typical day');
    expect(md).toContain('- **UX researcher:** UX researcher core skills');
    expect(md).toContain('- **Product manager:** Product manager main challenge');
  });

  it('ends with AI-generated footer', () => {
    const md = comparisonToMarkdown(makeComparison('quick', 2));
    expect(md.trim().endsWith(
      '*AI-generated comparison. Treat specific salary figures and training timelines as starting points, not guarantees.*'
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/markdown-export.test.ts`
Expected: FAIL — `comparisonToMarkdown` not exported.

- [ ] **Step 3: Add `comparisonToMarkdown` to `lib/markdown-export.ts`**

Add `Comparison, ComparisonRole, ComparisonDimension` to the existing import from `./session-store`:

```ts
import type { GapAnalysis, LearningPath, InterviewFeedback, InterviewPhase, SourceRef, OdysseyLife, OdysseyLifeType, OdysseyDashboard, BoardReview, Comparison, ComparisonRole, ComparisonDimension } from './session-store';
```

Append to the bottom of the file:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/markdown-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown-export.ts lib/markdown-export.test.ts
git commit -m "feat(export): add comparisonToMarkdown"
```

---

## Task 4: `app/api/compare/route.ts` — API route with trim-retry

**Files:**
- Create: `app/api/compare/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server';
import { getLLMConfig, getLLMProvider, type LLMConfig } from '@/lib/llm-providers';
import { buildComparePrompt, parseComparison, type CompareInput } from '@/lib/prompts/compare';
import { isTokenLimitError } from '@/lib/token-limit';

interface CompareRequest extends CompareInput {
  llmConfig?: LLMConfig;
}

const TARGET_TRIM_CHARS = 4000;
const RESUME_TRIM_CHARS = 4000;

function trimTargets(input: CompareInput): CompareInput {
  return {
    ...input,
    targets: input.targets.map((t) =>
      t.label.length > TARGET_TRIM_CHARS
        ? { ...t, label: t.label.slice(0, TARGET_TRIM_CHARS) }
        : t
    ),
  };
}

function trimResume(input: CompareInput): CompareInput {
  if (input.resume && input.resume.length > RESUME_TRIM_CHARS) {
    return { ...input, resume: input.resume.slice(0, RESUME_TRIM_CHARS) };
  }
  return input;
}

const SYSTEM =
  'You produce structured JSON comparisons of career paths across fixed dimensions. You ONLY respond in JSON.';

export async function POST(request: NextRequest) {
  try {
    const { llmConfig: clientConfig, ...input } =
      (await request.json()) as CompareRequest;

    if (!Array.isArray(input.targets) || input.targets.length < 2 || input.targets.length > 3) {
      return new Response(
        JSON.stringify({ error: 'Comparison needs 2 or 3 targets.' }),
        { status: 400 }
      );
    }

    for (const t of input.targets) {
      if (!t || typeof t.label !== 'string' || !t.label.trim()) {
        return new Response(
          JSON.stringify({ error: 'Each target needs a non-empty label.' }),
          { status: 400 }
        );
      }
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
          { role: 'user', content: buildComparePrompt(current) },
        ],
        llmConfig
      );
    } catch (err) {
      if (!isTokenLimitError(err)) throw err;
      trimmed = true;
      current = trimTargets(current);
      try {
        raw = await provider.createCompletion(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: buildComparePrompt(current) },
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
              { role: 'user', content: buildComparePrompt(current) },
            ],
            llmConfig
          );
        } catch (err3) {
          if (!isTokenLimitError(err3)) throw err3;
          return new Response(
            JSON.stringify({
              error: 'These comparisons are too long to run together. Try shorter descriptions or remove a target.',
            }),
            { status: 500 }
          );
        }
      }
    }

    const comparison = parseComparison(raw!, current);
    return new Response(JSON.stringify({ comparison, trimmed }), { status: 200 });
  } catch (error) {
    console.error('[compare] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/compare/route.ts
git commit -m "feat(api): add /api/compare with trim-retry on token limits"
```

---

## Task 5: `CompareTable` component

**Files:**
- Create: `components/compare/CompareTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { Comparison, ComparisonDimension } from '@/lib/session-store';

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

type Props = {
  comparison: Comparison;
};

export default function CompareTable({ comparison }: Props) {
  const { roles } = comparison;
  const colsClass =
    roles.length === 2
      ? 'md:grid-cols-[auto_1fr_1fr]'
      : 'md:grid-cols-[auto_1fr_1fr_1fr]';

  return (
    <div className='mt-6'>
      {/* Desktop grid */}
      <div className={`hidden md:grid ${colsClass} border border-border rounded-lg overflow-hidden bg-paper`}>
        {/* Header row: empty corner + role labels */}
        <div className='border-b border-border bg-paper-warm p-4'></div>
        {roles.map((role) => (
          <div
            key={role.label}
            className='border-b border-l border-border bg-paper-warm p-4 text-[var(--text-base)] font-semibold text-ink'
          >
            {role.label}
          </div>
        ))}

        {/* Dimension rows */}
        {DIMENSION_ORDER.map((dim, i) => (
          <div key={dim} className='contents'>
            <div
              className={`p-4 text-[var(--text-sm)] text-ink-muted font-medium ${
                i < DIMENSION_ORDER.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {DIMENSION_LABELS[dim]}
            </div>
            {roles.map((role) => (
              <div
                key={role.label + dim}
                className={`p-4 text-ink-muted leading-relaxed border-l border-border ${
                  i < DIMENSION_ORDER.length - 1 ? 'border-b' : ''
                }`}
              >
                {role.cells[dim]}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile stacked cards */}
      <div className='md:hidden space-y-4'>
        {roles.map((role) => (
          <div key={role.label} className='border border-border rounded-lg bg-paper p-5'>
            <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-4'>{role.label}</h3>
            <dl className='space-y-3'>
              {DIMENSION_ORDER.map((dim) => (
                <div key={dim}>
                  <dt className='text-[var(--text-xs)] text-ink-quiet uppercase tracking-wide'>
                    {DIMENSION_LABELS[dim]}
                  </dt>
                  <dd className='text-ink-muted leading-relaxed mt-1'>{role.cells[dim]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/compare/CompareTable.tsx
git commit -m "feat(compare): add CompareTable with desktop grid and mobile stacked fallback"
```

---

## Task 6: `CompareInputCard` component

**Files:**
- Create: `components/compare/CompareInputCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LoadingDots from '@/components/ui/loadingdots';
import { useSessionStore, type Comparison } from '@/lib/session-store';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function CompareInputCard() {
  const router = useRouter();
  const store = useSessionStore();
  const [target1, setTarget1] = useState('');
  const [target2, setTarget2] = useState('');
  const [target3, setTarget3] = useState('');
  const [prefillLabel, setPrefillLabel] = useState(false);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const prefill = store.consumeComparePrefill();
    if (prefill?.seedTarget) {
      setTarget1(prefill.seedTarget);
      setPrefillLabel(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRun = target1.trim().length > 0 && target2.trim().length > 0;

  async function ensureProvider(): Promise<boolean> {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      router.push('/settings');
      return false;
    }
    return true;
  }

  async function runCompare() {
    if (!canRun) return;
    if (!(await ensureProvider())) return;

    setComparing(true);
    try {
      const llmConfig = await loadLLMConfig();
      const targets = [
        { label: target1.trim() },
        { label: target2.trim() },
      ];
      if (target3.trim()) targets.push({ label: target3.trim() });

      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'quick',
          targets,
          resume: store.resumeText ?? undefined,
          freeText: store.freeText || undefined,
          distilledProfile: store.distilledProfile ?? undefined,
          llmConfig,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'The comparison could not be run.');
      }
      const { comparison, trimmed } = (await res.json()) as {
        comparison: Comparison;
        trimmed?: boolean;
      };
      store.setComparison(comparison);
      if (trimmed) {
        toast('Context was trimmed to fit the model window.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'The comparison came back garbled. Try again — a second attempt often works.'
      );
    } finally {
      setComparing(false);
    }
  }

  return (
    <div className='border border-border rounded-lg bg-paper p-6'>
      <div className='editorial-rule justify-center mb-2'>
        <span>Compare careers</span>
      </div>
      <h2 className='text-[var(--text-2xl)] font-semibold text-ink text-center mb-2'>
        Quick side-by-side across seven dimensions
      </h2>

      <div className='border-l-2 border-accent p-4 bg-paper-warm mb-6 mt-4'>
        <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
          Quick compare is vague. It makes assumptions about each role. For a richer
          comparison, run <strong>Find my careers</strong> first, pick 2 or 3 from the
          spider graph, and compare from there.
        </p>
      </div>

      <div className='space-y-4'>
        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            Target 1 {prefillLabel && <span className='text-ink-quiet'>(from landing)</span>}
          </label>
          <Textarea
            value={target1}
            rows={2}
            onChange={(e) => {
              setTarget1(e.target.value);
              setPrefillLabel(false);
            }}
            placeholder='Job title or paste a short job advert.'
            disabled={comparing}
          />
        </div>

        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            Target 2 <span className='text-ink-quiet'>(required)</span>
          </label>
          <Textarea
            value={target2}
            rows={2}
            onChange={(e) => setTarget2(e.target.value)}
            placeholder='Job title (e.g. UX researcher) or paste a short job advert.'
            disabled={comparing}
          />
        </div>

        <div>
          <label className='block text-[var(--text-sm)] text-ink-muted mb-1'>
            Target 3 <span className='text-ink-quiet'>(optional)</span>
          </label>
          <Textarea
            value={target3}
            rows={2}
            onChange={(e) => setTarget3(e.target.value)}
            placeholder='Job title or paste a short job advert.'
            disabled={comparing}
          />
        </div>

        <p className='text-[var(--text-xs)] text-ink-quiet text-center italic'>
          Comparison uses your profile (resume / about you) for personalised framing if available.
        </p>

        <div className='flex justify-center pt-2'>
          <Button onClick={runCompare} disabled={!canRun || comparing}>
            {comparing ? (
              <>
                <LoadingDots color='white' /> Comparing…
              </>
            ) : (
              <>
                <Columns3 className='w-4 h-4 mr-2' />
                Run comparison
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/compare/CompareInputCard.tsx
git commit -m "feat(compare): add CompareInputCard with three target slots and helper note"
```

---

## Task 7: `app/compare/page.tsx` — orchestrator page

**Files:**
- Create: `app/compare/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoadingDots from '@/components/ui/loadingdots';
import CopyMarkdownButton from '@/components/results/CopyMarkdownButton';
import CompareInputCard from '@/components/compare/CompareInputCard';
import CompareTable from '@/components/compare/CompareTable';
import { useSessionStore, type Comparison, type CompareTarget } from '@/lib/session-store';
import { comparisonToMarkdown } from '@/lib/markdown-export';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function ComparePage() {
  const router = useRouter();
  const store = useSessionStore();
  const { comparison } = store;
  const [loading, setLoading] = useState(false);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const prefill = store.consumeComparePrefill();
    if (!prefill?.richCareerTitles || prefill.richCareerTitles.length < 2) {
      // Quick mode: CompareInputCard handles the seedTarget itself via its own consume call
      // (but we've already consumed it here — so write it back for the card to pick up)
      if (prefill?.seedTarget) {
        store.setComparePrefill({ seedTarget: prefill.seedTarget });
      }
      return;
    }

    // Rich mode: resolve career titles to finalCareerInfo and auto-fire
    const careers = store.careers ?? [];
    const resolved = prefill.richCareerTitles
      .map((title) => careers.find((c) => c.jobTitle === title))
      .filter((c): c is NonNullable<typeof c> => !!c);

    if (resolved.length !== prefill.richCareerTitles.length) {
      toast.error('The selected careers are no longer available. Generate careers again and retry.');
      return;
    }

    (async () => {
      if (!(await isLLMConfigured())) {
        toast.error('Set up an LLM provider first.');
        router.push('/settings');
        return;
      }
      setLoading(true);
      try {
        const llmConfig = await loadLLMConfig();
        const targets = resolved.map((c) => ({ label: c.jobTitle, context: c }));
        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'rich',
            targets,
            resume: store.resumeText ?? undefined,
            freeText: store.freeText || undefined,
            distilledProfile: store.distilledProfile ?? undefined,
            llmConfig,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'The comparison could not be run.');
        }
        const { comparison: result } = (await res.json()) as { comparison: Comparison };
        store.setComparison(result);
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error
            ? err.message
            : 'The comparison came back garbled. Try again — a second attempt often works.'
        );
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
    router.push('/');
  }

  function handleRunAnother() {
    if (!comparison) return;
    if (!confirm('Run another comparison? The current result will be cleared.')) return;
    if (comparison.roles.length > 0) {
      store.setComparePrefill({ seedTarget: comparison.roles[0].label });
    }
    store.setComparison(null);
  }

  function handleGapForRole(label: string) {
    store.setJobTitle(label);
    router.push('/gap-analysis');
  }

  return (
    <div className='h-full overflow-y-auto'>
      <div className='container mx-auto p-6 max-w-5xl'>
        <div className='flex items-center justify-between mb-6'>
          <Link href='/' className='flex items-center gap-2 text-ink-muted hover:text-ink'>
            <ArrowLeft className='w-4 h-4' />
            Back to landing
          </Link>
          <div className='flex items-center gap-3'>
            {comparison && (
              <>
                <CopyMarkdownButton
                  getMarkdown={() => comparisonToMarkdown(comparison)}
                  label='Copy as Markdown'
                />
                <Button variant='outline' onClick={handleRunAnother}>
                  Run another
                </Button>
              </>
            )}
            <Button variant='outline' onClick={handleStartOver}>
              Start over
            </Button>
          </div>
        </div>

        {loading && (
          <div className='border border-border rounded-lg bg-paper p-10 flex flex-col items-center gap-4'>
            <LoadingDots color='gray' />
            <p className='text-ink-muted'>Comparing careers…</p>
          </div>
        )}

        {!loading && !comparison && <CompareInputCard />}

        {!loading && comparison && (
          <div>
            <div className='editorial-rule justify-center mb-2'>
              <span>Career comparison</span>
            </div>
            <h1 className='text-[var(--text-3xl)] font-semibold text-ink text-center mb-2'>
              {comparison.roles.length} roles side-by-side
            </h1>

            {comparison.mode === 'quick' && (
              <div className='border-l-2 border-accent p-4 bg-paper-warm mt-4 mb-6'>
                <p className='text-ink-muted text-[var(--text-sm)] leading-relaxed'>
                  This is a quick compare — the LLM inferred each role's details. For a
                  richer comparison based on your generated careers, run{' '}
                  <strong>Find my careers</strong> from the landing page.
                </p>
              </div>
            )}

            <CompareTable comparison={comparison} />

            <div className='mt-8 pt-6 border-t border-border'>
              <div className='editorial-rule justify-center mb-4'>
                <span>Next steps</span>
              </div>
              <div className='flex flex-wrap justify-center gap-3'>
                {comparison.roles.map((role) => (
                  <Button
                    key={role.label}
                    variant='outline'
                    size='sm'
                    onClick={() => handleGapForRole(role.label)}
                  >
                    Analyse gaps for {role.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
```

A note on the ref pattern: `consumedRef` prevents the effect from double-running during React Strict Mode, which would otherwise consume the prefill twice (first call gets the data, second call gets null and skips everything). The effect has a `consumeComparePrefill()` side-effect so we can't just let it run twice.

A note on the quick-mode flow: `CompareInputCard` also calls `consumeComparePrefill()` in its own `useEffect`. If this page already consumed it, the card gets null and the slots stay empty. To avoid that, this page's effect writes the `seedTarget` back into the store when it's not a rich-mode prefill. Slightly awkward but avoids a prop-drill.

Alternative cleaner approach: only consume here when it's the rich-mode case, and peek-without-consuming otherwise. But the store doesn't expose peek. The write-back is the pragmatic path.

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. If `CompareTarget` isn't exported from `@/lib/session-store`, remove it from the import — it's only used for type inference and can be dropped if the page doesn't need it directly.

- [ ] **Step 3: Commit**

```bash
git add app/compare/page.tsx
git commit -m "feat(compare): add /compare orchestrator with quick and rich mode flows"
```

---

## Task 8: `ActionsZone` + `ActionWillUse` — add Compare careers to Discover group

**Files:**
- Modify: `components/landing/ActionsZone.tsx`
- Modify: `components/landing/ActionWillUse.tsx`

- [ ] **Step 1: Add `'compare'` case to `ActionWillUse.tsx`**

In the `ActionId` type at the top of `ActionWillUse.tsx`, add `'compare'`:

```ts
export type ActionId = 'careers' | 'chat' | 'gaps' | 'learn' | 'interview' | 'odyssey' | 'board' | 'compare';
```

Add a `case 'compare':` to the switch in the `line()` function (before the final closing brace of the switch):

```ts
case 'compare': {
  if (!hasTarget) return 'Needs a target (job title or job advert).';
  return `Will use: ${filled.join(', ')}. Add more targets on the next page.`;
}
```

- [ ] **Step 2: Add the Compare careers button and handler in `ActionsZone.tsx`**

Add `Columns3` to the lucide import at the top:

```ts
import { Compass, MessageCircle, SearchCheck, Route as RouteIcon, Mic, Sparkles, Users, Columns3 } from 'lucide-react';
```

Add a new handler immediately after `handleBoard`:

```ts
  async function handleCompare() {
    clearMissingHints();
    const hasTarget = !!store.jobTitle.trim() || !!store.jobAdvert.trim();
    if (!hasTarget) {
      setMissingHints({
        resume: false,
        jobTitle: true,
        aboutYou: false,
        jobAdvert: true,
        message: 'Compare needs at least one job title or job advert to start. You can add more targets on the next page.',
      });
      focusFirstHint();
      return;
    }
    if (!(await ensureProvider())) return;
    store.setComparePrefill({
      seedTarget: store.jobAdvert.trim() || store.jobTitle.trim(),
    });
    router.push('/compare');
  }
```

In the Discover `<section>`, change the grid to three columns and add the Compare careers button as a third child:

```tsx
      <section>
        <div className='editorial-rule justify-center mb-3'>
          <span>Discover</span>
        </div>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          <div className='flex flex-col'>
            <Button onClick={handleFindCareers} disabled={anyRunning} className='py-6'>
              <Compass className='w-4 h-4 mr-2' />
              Find my careers
            </Button>
            <ActionWillUse actionId='careers' />
          </div>
          <div className='flex flex-col'>
            <Button onClick={handleStartChatting} disabled={anyRunning} variant='outline' className='py-6'>
              <MessageCircle className='w-4 h-4 mr-2' />
              Start chatting
            </Button>
            <ActionWillUse actionId='chat' />
          </div>
          <div className='flex flex-col'>
            <Button onClick={handleCompare} disabled={anyRunning} variant='outline' className='py-6'>
              <Columns3 className='w-4 h-4 mr-2' />
              Compare careers
            </Button>
            <ActionWillUse actionId='compare' />
          </div>
        </div>
      </section>
```

If the existing Discover section uses a slightly different wrapping pattern (e.g. `grid-cols-2` without `md:grid-cols-3`), adapt to whatever's already there — the key change is *adding a third child and expanding the grid to md:grid-cols-3*.

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/landing/ActionsZone.tsx components/landing/ActionWillUse.tsx
git commit -m "feat(landing): add Compare careers button with gate and live caption"
```

---

## Task 9: `OutputsBanner` — comparison quick-jump link

**Files:**
- Modify: `components/landing/OutputsBanner.tsx`

- [ ] **Step 1: Add detection and link**

Add `comparison` to the existing `store` destructure:

```ts
  const {
    chatMessages,
    careers,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
    odysseyLives,
    boardReview,
    comparison,
  } = store;
```

Add detection after `hasBoard`:

```ts
  const hasComparison = !!comparison;
```

Add `!hasComparison` to the early-return guard condition.

Add the link inside the flex row, after the board link:

```tsx
        {hasComparison && (
          <Link href='/compare' className='underline hover:text-accent'>
            comparison ready
          </Link>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/OutputsBanner.tsx
git commit -m "feat(landing): add comparison quick-jump link to OutputsBanner"
```

---

## Task 10: `CareerNode` — "Compare this role" toggle + ring selection state

**Files:**
- Modify: `components/CareerNode.tsx`

- [ ] **Step 1: Read the file first**

Read `components/CareerNode.tsx` to find:
- Where existing shortcut buttons render (Chat about this, Analyse gaps, Learning path, Ask the board)
- The exact styling pattern they use (`variant`, `size`, icon sizing, container layout)
- Where the card's outer border div lives (so the ring can be added conditionally)
- Whether `useSessionStore` and `useRouter` are imported
- Whether `lucide-react` is imported and which icons are already in use

- [ ] **Step 2: Add imports**

Add to existing lucide import:

```ts
import { Columns3, X } from 'lucide-react';
```

(And whatever else was already imported.)

Add to the existing session store import (or add one if missing):

```ts
import { useSessionStore } from '@/lib/session-store';
```

- [ ] **Step 3: Read `comparing` state and compute the flags**

Near the top of the component function body, subscribe to `comparing` state:

```ts
  const comparing = useSessionStore((s) => s.comparing);
  const inComparison = comparing.includes(data.jobTitle);
  const atMaxComparison = comparing.length >= 3 && !inComparison;
```

- [ ] **Step 4: Add the ring to the outer card container**

Find the outermost `<div>` that wraps the card body (the one with the existing card styling — likely `border`, `rounded`, `p-...`). Add a conditional class:

```tsx
<div className={`... existing classes ... ${inComparison ? 'ring-2 ring-accent' : ''}`}>
```

Match whatever the existing class list looks like — just append the conditional ring class.

- [ ] **Step 5: Add the toggle button to the shortcut row**

In the shortcut row (the place where "Chat about this", "Analyse gaps for this role", etc. render), add a new button adjacent to the existing ones. Match their exact `variant` and `size` props:

```tsx
<Button
  variant='outline'
  size='sm'
  onClick={() => useSessionStore.getState().toggleComparing(data.jobTitle)}
  disabled={atMaxComparison}
  title={atMaxComparison ? 'Maximum 3 roles. Remove one to add another.' : undefined}
>
  {inComparison ? (
    <>
      <X className='w-3 h-3 mr-1' />
      Remove from comparison
    </>
  ) : (
    <>
      <Columns3 className='w-3 h-3 mr-1' />
      Compare this role
    </>
  )}
</Button>
```

Substitute `data.jobTitle` with whatever field name the component uses for the career title. If the existing shortcuts use a different button component or wrapper, match that pattern.

- [ ] **Step 6: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/CareerNode.tsx
git commit -m "feat(careers): add Compare this role toggle with ring selection state"
```

---

## Task 11: `app/careers/page.tsx` — comparing banner

**Files:**
- Modify: `app/careers/page.tsx`

- [ ] **Step 1: Read the file**

Read `app/careers/page.tsx` to find:
- The top bar where "Start over" renders
- Where the ReactFlow container sits in the layout
- The existing imports for session store, router, Button, Link

- [ ] **Step 2: Add imports**

Add to the existing lucide import:

```ts
import { Columns3, X } from 'lucide-react';
```

(Plus whatever's already imported.)

- [ ] **Step 3: Read `comparing` from the store**

Add `comparing` to the existing store destructure:

```ts
  const {
    resumeText,
    freeText,
    jobTitle,
    jobAdvert,
    distilledProfile,
    careers,
    comparing,
  } = store;
```

(Keep any other fields already being destructured.)

- [ ] **Step 4: Add banner handlers**

Add these handlers inside the component function, near `handleStartOver`:

```ts
  function handleCompareLaunch() {
    if (comparing.length < 2) return;
    store.setComparePrefill({ richCareerTitles: [...comparing] });
    store.clearComparing();
    router.push('/compare');
  }

  function handleCompareCancel() {
    store.clearComparing();
  }
```

- [ ] **Step 5: Render the banner above the ReactFlow container**

Find the JSX where ReactFlow is rendered (wrapped in some flex container). Just above the ReactFlow wrapper, conditionally render the banner when `comparing.length > 0`:

```tsx
        {comparing.length > 0 && (
          <div className='mx-3 mt-3 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4 flex-wrap flex-shrink-0'>
            <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />
            <div className='flex-1 text-[var(--text-sm)] text-ink flex flex-wrap gap-x-2 gap-y-1 items-center'>
              <span className='text-ink-quiet'>Comparing:</span>
              <span className='font-medium'>{comparing.join(', ')}</span>
              <span className='text-ink-quiet italic'>
                {comparing.length < 3 ? 'click one more (optional)' : 'maximum reached'}
              </span>
            </div>
            <Button
              size='sm'
              onClick={handleCompareLaunch}
              disabled={comparing.length < 2}
            >
              <Columns3 className='w-3 h-3 mr-1' />
              Compare {comparing.length}
            </Button>
            <Button size='sm' variant='outline' onClick={handleCompareCancel}>
              <X className='w-3 h-3 mr-1' />
              Cancel
            </Button>
          </div>
        )}
```

Place this immediately inside the outer flex column of the `/careers` page, above the ReactFlow wrapper `<div>`. The `flex-shrink-0` on the banner prevents the ReactFlow container from squeezing below its minimum height.

- [ ] **Step 6: Verify it type-checks and runs**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/careers/page.tsx
git commit -m "feat(careers): add comparing banner above spider graph with launch and cancel"
```

---

## Task 12: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npx vitest run`
Expected: PASS — all prior tests plus new comparison tests (session store, compare prompt, compare parser, comparisonToMarkdown).

- [ ] **Step 2: Start the app in Electron dev mode**

Run: `npm run electron:dev`

- [ ] **Step 3: Walk the manual QA checklist from the spec**

From `docs/superpowers/specs/2026-04-16-f10-career-comparison-design.md`, walk every item under "Manual QA checklist". Specifically verify:

- Landing Discover group now shows three buttons (Find my careers, Start chatting, Compare careers)
- Transparency captions under Discover buttons reflect live state as inputs are filled
- Click Compare careers with no target → red highlight on Job title + Job advert rows with helper message
- Fill job title only → caption updates → click Compare careers → `/compare` with Target 1 pre-filled
- Helper note visible above the target slots on quick-mode input view
- Target 1 shows *(from landing)* label when pre-filled
- Target 2 required, Target 3 optional
- Run button disabled until Target 1 and Target 2 both filled
- Run with 2 filled → loading state → result view renders 2-column table
- Run with 3 filled → 3-column table
- All seven dimension rows visible in table (Typical day, Core skills, Training needed, Salary range, Work setting, Who it suits, Main challenge)
- Mobile viewport → table collapses to stacked cards (one per role)
- Copy as Markdown → includes mode header, all seven dimension sections, role bullets, footer
- Run another from result → confirms → returns to input view with previous Target 1 pre-filled
- Quick-mode reminder note visible above the result table
- Start over → full session cleared
- Run Find my careers → `/careers` page → each card now has "Compare this role" button
- Click "Compare this role" on one card → button flips to "Remove from comparison", card gets ring-2 ring-accent outline, top banner appears
- Banner shows the comma-joined list and "click one more (optional)" helper
- Click "Compare this role" on a second card → banner updates, Compare button activates
- Click "Compare this role" on a third card → banner says "maximum reached"
- Try to click a fourth card's "Compare this role" button → disabled with tooltip
- Click "Remove from comparison" on one of three → banner updates, that card loses its ring, fourth card re-enables
- Navigate away from `/careers` and back → banner and selection persist
- Click Cancel on banner → selection cleared, all rings removed, banner disappears
- Click Compare on banner with 2 or 3 selected → `/compare` renders in rich mode (skips input card), shows loading, renders table
- Rich mode Copy as Markdown → mode header shows "Rich compare"
- Analyse gaps for [role] chain buttons render below the table — one per role
- Click "Analyse gaps for Data analyst" → navigates to gap analysis flow
- OutputsBanner shows "comparison ready" once a comparison exists
- Click OutputsBanner link → returns to `/compare` result view
- No LLM provider configured → pre-flight redirect from landing button, quick-mode Run, and rich-mode mount
- Reload Electron → state lost (expected)
- All existing 7 action buttons still work and are in their correct groups (Discover now has 3, Assess has 3, Reflect has 2)
- Electron dev build end to end

- [ ] **Step 4: Fix any QA findings**

If any behaviour is wrong, commit fixes as separate commits.

---

## Notes for the implementer

- **Two modes, one code path.** Do not refactor into two parallel flows. Rich mode adds `context` to each target in the prompt input; everything else is identical.
- **`consumeBoardPrefill` / `consumeComparePrefill` pattern.** Read-and-clear on mount. The page-level orchestrator consumes once; if it's a quick-mode prefill, it writes the `seedTarget` back so `CompareInputCard`'s own mount effect can pick it up. This is pragmatic, not elegant — avoiding a prop drill between the page and the card.
- **React Strict Mode double-mount.** The orchestrator uses a `consumedRef` guard to avoid consuming the prefill twice during development. Don't remove it.
- **Studio Calm tokens only.** `bg-paper`, `border-border`, `text-ink`, `text-ink-muted`, `text-ink-quiet`, `text-accent`, `bg-accent-soft`, `bg-paper-warm`. No raw hex colours.
- **Em dashes** in UI copy are avoided per user preference. The `"—"` placeholder in missing cells is fine (structural), and em dashes in prompts sent to the LLM are fine (internal). Avoid em dashes in user-facing prose.
- **Landing placement.** Compare goes in **Discover**, not Reflect. Don't regroup it.
- **Five shortcut buttons on the career card** is a lot. If the shortcut row wraps awkwardly on narrow widths, accept the wrap — the cards aren't that narrow in practice.
- **Banner placement on `/careers`.** Above the ReactFlow container, with `flex-shrink-0` so it doesn't squeeze the graph. It's small when present, invisible when absent.
- **Rich-mode auto-fire** starts the LLM call as soon as the page mounts with valid rich-mode prefill. If the user navigates in with stale `careers` data (e.g. the careers array got cleared between selection on `/careers` and arrival on `/compare`), toast and fall back to the input card view.
- **Chain-out to gap analysis** just writes the role label to `store.jobTitle` and navigates to `/gap-analysis`. The gap analysis page has its own flow — don't try to orchestrate it from here.
- **Don't wire "Chat about this comparison"** — it's explicitly out of scope. Students can copy-paste if they want to talk about it.
- **`CompareTarget`** is exported from `lib/prompts/compare.ts`, NOT from `lib/session-store.ts`. If the orchestrator imports it from the wrong place, tsc will flag it.
