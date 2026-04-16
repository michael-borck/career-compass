import { describe, it, expect } from 'vitest';
import { buildPortfolioPrompt } from './portfolio';

describe('buildPortfolioPrompt', () => {
  it('includes resume when provided', () => {
    expect(buildPortfolioPrompt({ resume: 'Three years at Curtin University.' })).toContain('Curtin');
  });

  it('includes about-me when provided', () => {
    expect(buildPortfolioPrompt({ freeText: 'I enjoy working with data.' })).toContain('working with data');
  });

  it('includes target role when provided', () => {
    expect(buildPortfolioPrompt({ resume: 'r', jobTitle: 'Data analyst' })).toContain('Data analyst');
  });

  it('includes job advert when provided', () => {
    expect(buildPortfolioPrompt({ resume: 'r', jobAdvert: 'Hiring at Acme Corp.' })).toContain('Acme Corp');
  });

  it('asks for standalone HTML with inline CSS', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toMatch(/standalone.*HTML/i);
    expect(out).toMatch(/inline/i);
    expect(out).toMatch(/<style>/i);
  });

  it('specifies the design: dark navy header, system fonts', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toContain('#1a2332');
    expect(out).toContain('system');
  });

  it('includes all six section names', () => {
    const out = buildPortfolioPrompt({ resume: 'r' });
    expect(out).toContain('Hero');
    expect(out).toContain('About Me');
    expect(out).toContain('Key Experience');
    expect(out).toContain('Skills');
    expect(out).toMatch(/What I.*Looking For/);
    expect(out).toContain('Contact');
  });

  it('asks to start with DOCTYPE', () => {
    expect(buildPortfolioPrompt({ resume: 'r' })).toContain('<!DOCTYPE html>');
  });

  it('includes distilled profile when provided', () => {
    const out = buildPortfolioPrompt({
      resume: 'r',
      distilledProfile: {
        background: 'Public health undergrad',
        interests: ['community health'],
        skills: ['statistics'],
        constraints: [],
        goals: ['policy role'],
      },
    });
    expect(out).toMatch(/public health/i);
  });
});
