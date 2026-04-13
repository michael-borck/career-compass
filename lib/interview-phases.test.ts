import { describe, it, expect } from 'vitest';
import { PHASE_ORDER, PHASE_CONFIG, nextPhase } from './interview-phases';

describe('PHASE_ORDER', () => {
  it('is the expected 5 phases in order', () => {
    expect(PHASE_ORDER).toEqual([
      'warm-up',
      'behavioural',
      'role-specific',
      'your-questions',
      'wrap-up',
    ]);
  });
});

describe('PHASE_CONFIG turn counts', () => {
  it('warm-up has 1 turn', () => {
    expect(PHASE_CONFIG['warm-up'].turnsPerPhase).toBe(1);
  });
  it('behavioural has 2 turns', () => {
    expect(PHASE_CONFIG.behavioural.turnsPerPhase).toBe(2);
  });
  it('role-specific has 2 turns', () => {
    expect(PHASE_CONFIG['role-specific'].turnsPerPhase).toBe(2);
  });
  it('your-questions has 1 turn', () => {
    expect(PHASE_CONFIG['your-questions'].turnsPerPhase).toBe(1);
  });
  it('wrap-up has 1 turn', () => {
    expect(PHASE_CONFIG['wrap-up'].turnsPerPhase).toBe(1);
  });
  it('totals 7 interviewer turns', () => {
    const total = PHASE_ORDER.reduce(
      (n, p) => n + PHASE_CONFIG[p].turnsPerPhase,
      0
    );
    expect(total).toBe(7);
  });
});

describe('nextPhase', () => {
  it('warm-up turn 0 → behavioural turn 0 (warm-up has 1 turn)', () => {
    const r = nextPhase('warm-up', 0);
    expect(r).toEqual({ phase: 'behavioural', turnInPhase: 0, isComplete: false });
  });

  it('behavioural turn 0 → behavioural turn 1 (still in phase)', () => {
    const r = nextPhase('behavioural', 0);
    expect(r).toEqual({ phase: 'behavioural', turnInPhase: 1, isComplete: false });
  });

  it('behavioural turn 1 → role-specific turn 0', () => {
    const r = nextPhase('behavioural', 1);
    expect(r).toEqual({ phase: 'role-specific', turnInPhase: 0, isComplete: false });
  });

  it('role-specific turn 0 → role-specific turn 1', () => {
    const r = nextPhase('role-specific', 0);
    expect(r).toEqual({ phase: 'role-specific', turnInPhase: 1, isComplete: false });
  });

  it('role-specific turn 1 → your-questions turn 0', () => {
    const r = nextPhase('role-specific', 1);
    expect(r).toEqual({ phase: 'your-questions', turnInPhase: 0, isComplete: false });
  });

  it('your-questions turn 0 → wrap-up turn 0', () => {
    const r = nextPhase('your-questions', 0);
    expect(r).toEqual({ phase: 'wrap-up', turnInPhase: 0, isComplete: false });
  });

  it('wrap-up turn 0 → null with isComplete', () => {
    const r = nextPhase('wrap-up', 0);
    expect(r).toEqual({ phase: null, turnInPhase: 0, isComplete: true });
  });
});
