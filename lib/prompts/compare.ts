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
    out[dim] = typeof value === 'string' && value.trim() ? value.trim() : '\u2014';
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
