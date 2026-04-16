import { describe, it, expect } from 'vitest';
import { buildCoverLetterPrompt, parseCoverLetter } from './cover-letter';

describe('buildCoverLetterPrompt', () => {
  it('includes job title as target', () => {
    expect(buildCoverLetterPrompt({ jobTitle: 'Data analyst' })).toContain('Data analyst');
  });
  it('includes job advert', () => {
    expect(buildCoverLetterPrompt({ jobAdvert: 'Hiring at Acme Corp.' })).toContain('Acme Corp');
  });
  it('includes resume', () => {
    expect(buildCoverLetterPrompt({ resume: 'Student at Curtin.', jobTitle: 'Analyst' })).toContain('Curtin');
  });
  it('asks for greeting/body/closing JSON', () => {
    const out = buildCoverLetterPrompt({ jobTitle: 'Analyst' });
    expect(out).toContain('"greeting"');
    expect(out).toContain('"body"');
    expect(out).toContain('"closing"');
  });
});

describe('parseCoverLetter', () => {
  const happy = JSON.stringify({
    greeting: 'Dear Hiring Manager,',
    body: 'I am writing to express my interest.\n\nWith my background in statistics...',
    closing: 'Sincerely,\nStudent Name',
  });
  it('parses happy path', () => {
    const out = parseCoverLetter(happy);
    expect(out.greeting).toContain('Hiring Manager');
    expect(out.body).toContain('interest');
    expect(out.closing).toContain('Sincerely');
  });
  it('strips code fences', () => {
    expect(parseCoverLetter('```json\n' + happy + '\n```').greeting).toContain('Hiring');
  });
  it('throws on missing greeting', () => {
    expect(() => parseCoverLetter(JSON.stringify({ body: 'b', closing: 'c' }))).toThrow(/greeting/i);
  });
  it('throws on missing body', () => {
    expect(() => parseCoverLetter(JSON.stringify({ greeting: 'g', closing: 'c' }))).toThrow(/body/i);
  });
  it('throws on missing closing', () => {
    expect(() => parseCoverLetter(JSON.stringify({ greeting: 'g', body: 'b' }))).toThrow(/closing/i);
  });
});
