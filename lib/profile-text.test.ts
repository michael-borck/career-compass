import { describe, it, expect } from 'vitest';
import { profileToReadableText } from './profile-text';
import type { StudentProfile } from './session-store';

describe('profileToReadableText', () => {
  it('produces a paragraph from a full profile', () => {
    const p: StudentProfile = {
      background: 'A final-year business student from Perth with a marketing background',
      interests: ['data analysis', 'teaching', 'behavioural research'],
      skills: ['SQL basics', 'Excel', 'presentations'],
      constraints: ['remote work only'],
      goals: ['land a data role within 12 months'],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('A final-year business student from Perth');
    expect(out).toContain('data analysis');
    expect(out).toContain('SQL basics');
    expect(out).toContain('remote work only');
    expect(out).toContain('land a data role');
  });

  it('skips empty arrays without producing dangling sentences', () => {
    const p: StudentProfile = {
      background: 'A student',
      interests: [],
      skills: [],
      constraints: [],
      goals: [],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('A student');
    expect(out).not.toMatch(/My skills include\s*\./);
    expect(out).not.toMatch(/I'm interested in\s*\./);
  });

  it('handles a partial profile with only background and goals', () => {
    const p: StudentProfile = {
      background: 'A nursing student',
      interests: [],
      skills: [],
      constraints: [],
      goals: ['become a community health nurse'],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('A nursing student');
    expect(out).toContain('become a community health nurse');
  });

  it('joins multi-item lists with commas', () => {
    const p: StudentProfile = {
      background: 'X',
      interests: ['a', 'b', 'c'],
      skills: [],
      constraints: [],
      goals: [],
    };
    const out = profileToReadableText(p);
    expect(out).toContain('a, b, c');
  });
});
