import { describe, it, expect } from 'vitest';
import { buildInterviewSystemPrompt } from './interview';
import type { SourceRef } from '@/lib/session-store';

describe('buildInterviewSystemPrompt', () => {
  it('includes the target role name', () => {
    const out = buildInterviewSystemPrompt({
      target: 'Data Analyst',
      difficulty: 'standard',
      phase: 'warm-up',
      turnInPhase: 0,
    });
    expect(out).toContain('Data Analyst');
  });

  it('includes the difficulty label', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'tough',
      phase: 'warm-up',
      turnInPhase: 0,
    });
    expect(out).toContain('DIFFICULTY: tough');
  });

  it('different difficulties produce different tone instructions', () => {
    const friendly = buildInterviewSystemPrompt({
      target: 'X', difficulty: 'friendly', phase: 'warm-up', turnInPhase: 0,
    });
    const tough = buildInterviewSystemPrompt({
      target: 'X', difficulty: 'tough', phase: 'warm-up', turnInPhase: 0,
    });
    expect(friendly).toContain('encouraging');
    expect(tough).toContain('pointed');
    expect(friendly).not.toBe(tough);
  });

  it('includes the current phase description', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'behavioural',
      turnInPhase: 0,
    });
    expect(out).toContain('Behavioural');
    expect(out).toContain('STAR');
  });

  it('includes the turn counter in 1-indexed form', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'behavioural',
      turnInPhase: 1,
    });
    expect(out).toContain('Turn 2 of 2');
  });

  it('first turn shows as Turn 1 of N', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'behavioural',
      turnInPhase: 0,
    });
    expect(out).toContain('Turn 1 of 2');
  });

  it('includes the global rules', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X', difficulty: 'standard', phase: 'warm-up', turnInPhase: 0,
    });
    expect(out).toContain('exactly ONE question');
    expect(out).toContain('Do not break character');
  });

  it('includes sources block when sources are provided in role-specific phase', () => {
    const sources: SourceRef[] = [
      { title: 'Example', url: 'https://example.com', domain: 'example.com' },
    ];
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'role-specific',
      turnInPhase: 0,
      sources,
    });
    expect(out).toContain('<sources>');
    expect(out).toContain('Example');
  });

  it('does NOT include sources block in warm-up phase even with sources provided', () => {
    const sources: SourceRef[] = [
      { title: 'Example', url: 'https://example.com', domain: 'example.com' },
    ];
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'warm-up',
      turnInPhase: 0,
      sources,
    });
    expect(out).not.toContain('<sources>');
  });

  it('does NOT include sources block when sources are empty', () => {
    const out = buildInterviewSystemPrompt({
      target: 'X',
      difficulty: 'standard',
      phase: 'role-specific',
      turnInPhase: 0,
      sources: [],
    });
    expect(out).not.toContain('<sources>');
  });
});
