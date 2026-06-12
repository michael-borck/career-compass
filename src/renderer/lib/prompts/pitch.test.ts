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
    fullScript:
      'Did you know data drives every decision? I bring three years of analytical experience. I am looking for an entry-level analyst role.',
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
    expect(() => parsePitch(JSON.stringify({ body: 'b', close: 'c', fullScript: 'f' }))).toThrow(
      /hook/i
    );
  });
  it('throws on missing body', () => {
    expect(() => parsePitch(JSON.stringify({ hook: 'h', close: 'c', fullScript: 'f' }))).toThrow(
      /body/i
    );
  });
  it('throws on missing fullScript', () => {
    expect(() => parsePitch(JSON.stringify({ hook: 'h', body: 'b', close: 'c' }))).toThrow(
      /fullScript/i
    );
  });
});

describe('buildPitchPrompt — career story threading', () => {
  it('includes the career story narrative and themes when provided', () => {
    const prompt = buildPitchPrompt({
      jobTitle: 'Data analyst',
      careerStory: {
        narrative: 'It started in a lab.',
        themes: [
          { name: 'Curiosity', evidence: [], reflectionQuestion: '' },
          { name: 'Service', evidence: [], reflectionQuestion: '' },
        ],
      },
    });
    expect(prompt).toContain('<careerStory>');
    expect(prompt).toContain('It started in a lab.');
    expect(prompt).toContain('Themes: Curiosity, Service');
    expect(prompt).toContain('narrative thread and themes are the spine');
  });

  it('omits the section without a career story', () => {
    expect(buildPitchPrompt({ jobTitle: 'Data analyst' })).not.toContain('<careerStory>');
  });
});
