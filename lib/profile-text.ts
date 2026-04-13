import type { StudentProfile } from './session-store';

/**
 * Turns a StudentProfile JSON into a single human-readable paragraph
 * suitable for pre-filling the "About you" textarea on the landing page.
 *
 * Empty arrays are skipped so we don't emit dangling sentences like
 * "My skills include ." Partial profiles render gracefully.
 */
export function profileToReadableText(p: StudentProfile): string {
  const sentences: string[] = [];

  if (p.background && p.background.trim()) {
    const bg = p.background.trim().replace(/\.$/, '');
    sentences.push(`${bg}.`);
  }

  if (p.interests && p.interests.length > 0) {
    sentences.push(`I'm interested in ${p.interests.join(', ')}.`);
  }

  if (p.skills && p.skills.length > 0) {
    sentences.push(`My skills include ${p.skills.join(', ')}.`);
  }

  if (p.constraints && p.constraints.length > 0) {
    sentences.push(`Constraints: ${p.constraints.join(', ')}.`);
  }

  if (p.goals && p.goals.length > 0) {
    sentences.push(`My goal is to ${p.goals.join(', and to ')}.`);
  }

  return sentences.join(' ');
}
