import { describe, it, expect } from 'vitest';
import { pitchToExportDoc } from './pitch';
import { toMarkdown } from '../to-markdown';
import type { ElevatorPitch } from '@/lib/session-store';

const pitch: ElevatorPitch = {
  target: 'Networking event',
  hook: 'I turn messy data into decisions.',
  body: 'Para one.\n\nPara two.',
  close: 'Could I grab fifteen minutes?',
  fullScript: 'Full script line one.\n\nFull script line two.',
};

describe('pitchToExportDoc', () => {
  it('renders target, hook, body paragraphs, close, and full script', () => {
    const md = toMarkdown(pitchToExportDoc(pitch));
    expect(md).toContain('# Elevator Pitch');
    expect(md).toContain('**Target:** Networking event');
    expect(md).toContain('## Your hook');
    expect(md).toContain('I turn messy data into decisions.');
    expect(md).toContain('Para one.');
    expect(md).toContain('Para two.');
    expect(md).toContain('## Your close');
    expect(md).toContain('## Full script');
    expect(md).toContain('Full script line two.');
  });

  it('falls back to General when there is no target', () => {
    const md = toMarkdown(pitchToExportDoc({ ...pitch, target: null }));
    expect(md).toContain('**Target:** General');
  });
});
