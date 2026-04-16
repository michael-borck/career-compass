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
    expect(parsePitch('```json\n' + happy + '\n```').hook).toContain('data');
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
