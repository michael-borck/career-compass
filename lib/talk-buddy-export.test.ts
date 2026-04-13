import { describe, it, expect } from 'vitest';
import { buildTalkBuddyScenario } from './talk-buddy-export';

describe('buildTalkBuddyScenario', () => {
  it('returns a filename and json string', () => {
    const out = buildTalkBuddyScenario('Data Analyst', 'standard');
    expect(typeof out.filename).toBe('string');
    expect(typeof out.json).toBe('string');
  });

  it('filename is slugified', () => {
    const out = buildTalkBuddyScenario('Senior Data Analyst (UK)', 'standard');
    expect(out.filename).toBe('mock-interview-senior-data-analyst-uk.json');
  });

  it('json parses back to a valid scenario', () => {
    const out = buildTalkBuddyScenario('Data Analyst', 'standard');
    const obj = JSON.parse(out.json);
    expect(obj.name).toBe('Mock Interview: Data Analyst');
    expect(obj.category).toBe('Interview Practice');
    expect(obj.difficulty).toBe('intermediate');
    expect(typeof obj.estimatedMinutes).toBe('number');
    expect(obj.estimatedMinutes).toBeGreaterThan(0);
    expect(typeof obj.systemPrompt).toBe('string');
    expect(typeof obj.initialMessage).toBe('string');
    expect(Array.isArray(obj.tags)).toBe(true);
  });

  it('maps friendly to beginner', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('X', 'friendly').json);
    expect(obj.difficulty).toBe('beginner');
  });

  it('maps standard to intermediate', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('X', 'standard').json);
    expect(obj.difficulty).toBe('intermediate');
  });

  it('maps tough to advanced', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('X', 'tough').json);
    expect(obj.difficulty).toBe('advanced');
  });

  it('system prompt includes the target name and all 5 phases', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('Data Analyst', 'standard').json);
    expect(obj.systemPrompt).toContain('Data Analyst');
    expect(obj.systemPrompt).toContain('WARM-UP');
    expect(obj.systemPrompt).toContain('BEHAVIOURAL');
    expect(obj.systemPrompt).toContain('ROLE-SPECIFIC');
    expect(obj.systemPrompt).toContain('YOUR QUESTIONS');
    expect(obj.systemPrompt).toContain('WRAP-UP');
  });

  it('initial message includes the target name', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('Data Analyst', 'standard').json);
    expect(obj.initialMessage).toContain('Data Analyst');
  });

  it('tags include interview and slugified target', () => {
    const obj = JSON.parse(buildTalkBuddyScenario('Data Analyst', 'standard').json);
    expect(obj.tags).toContain('interview');
    expect(obj.tags).toContain('career-compass');
    expect(obj.tags).toContain('data-analyst');
  });
});
