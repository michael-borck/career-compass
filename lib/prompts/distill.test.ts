import { describe, it, expect } from 'vitest';
import { buildDistillationPrompt, parseDistilledProfile } from './distill';
import type { ChatMessage } from '@/lib/session-store';

function m(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: Math.random().toString(),
    role,
    content,
    timestamp: Date.now(),
    kind: 'message',
  };
}

describe('buildDistillationPrompt', () => {
  it('includes the full chat transcript', () => {
    const msgs = [m('user', 'I want to work with data'), m('assistant', 'Tell me more')];
    const out = buildDistillationPrompt({ messages: msgs });
    expect(out).toContain('I want to work with data');
    expect(out).toContain('Tell me more');
  });

  it('mentions JSON shape fields', () => {
    const out = buildDistillationPrompt({ messages: [m('user', 'x')] });
    expect(out).toContain('background');
    expect(out).toContain('interests');
    expect(out).toContain('skills');
    expect(out).toContain('constraints');
    expect(out).toContain('goals');
  });

  it('prepends the trim notice when trimmed=true', () => {
    const out = buildDistillationPrompt({ messages: [m('user', 'x')], trimmed: true });
    expect(out).toContain('recent portion of a longer conversation');
  });

  it('appends guidance when provided', () => {
    const out = buildDistillationPrompt({
      messages: [m('user', 'x')],
      guidance: 'focus on the data analyst thread',
    });
    expect(out).toContain('focus on the data analyst thread');
  });

  it('includes resume/text/title attachments when provided', () => {
    const out = buildDistillationPrompt({
      messages: [m('user', 'x')],
      resume: 'my resume',
      freeText: 'my text',
      jobTitle: 'Analyst',
    });
    expect(out).toContain('my resume');
    expect(out).toContain('my text');
    expect(out).toContain('Analyst');
  });
});

describe('parseDistilledProfile', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({
      background: 'CS student',
      interests: ['data'],
      skills: ['python'],
      constraints: [],
      goals: ['data role'],
    });
    const p = parseDistilledProfile(raw);
    expect(p.background).toBe('CS student');
    expect(p.interests).toEqual(['data']);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"background":"B","interests":[],"skills":[],"constraints":[],"goals":[]}\n```';
    const p = parseDistilledProfile(raw);
    expect(p.background).toBe('B');
  });

  it('throws on missing background', () => {
    expect(() => parseDistilledProfile('{"background":""}')).toThrow();
  });

  it('coerces missing arrays to empty arrays when background is present', () => {
    const raw = JSON.stringify({
      background: 'B',
      interests: null,
      skills: undefined,
      constraints: [],
      goals: [],
    });
    const p = parseDistilledProfile(raw);
    expect(p.interests).toEqual([]);
    expect(p.skills).toEqual([]);
  });
});
