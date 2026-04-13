import { describe, it, expect } from 'vitest';
import { buildFeedbackPrompt, parseFeedback } from './interview-feedback';
import type { ChatMessage } from '@/lib/session-store';

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: Math.random().toString(),
    role,
    content,
    timestamp: Date.now(),
    kind: 'message',
  };
}

describe('buildFeedbackPrompt', () => {
  it('includes the target and difficulty', () => {
    const out = buildFeedbackPrompt({
      target: 'Data Analyst',
      difficulty: 'standard',
      messages: [msg('user', 'I have SQL skills')],
      reachedPhase: 'wrap-up',
    });
    expect(out).toContain('Data Analyst');
    expect(out).toContain('standard');
  });

  it('includes the transcript', () => {
    const out = buildFeedbackPrompt({
      target: 'X',
      difficulty: 'standard',
      messages: [
        msg('assistant', 'Tell me about yourself'),
        msg('user', 'I am a CS student'),
      ],
      reachedPhase: 'wrap-up',
    });
    expect(out).toContain('Tell me about yourself');
    expect(out).toContain('I am a CS student');
  });

  it('mentions partial-interview when reachedPhase is not wrap-up', () => {
    const out = buildFeedbackPrompt({
      target: 'X',
      difficulty: 'standard',
      messages: [msg('user', 'x')],
      reachedPhase: 'behavioural',
    });
    expect(out).toMatch(/early|partial|incomplete/i);
  });

  it('does not mention partial when reachedPhase is wrap-up', () => {
    const out = buildFeedbackPrompt({
      target: 'X',
      difficulty: 'standard',
      messages: [msg('user', 'x')],
      reachedPhase: 'wrap-up',
    });
    expect(out).not.toMatch(/ended early/i);
  });

  it('asks for the InterviewFeedback JSON shape', () => {
    const out = buildFeedbackPrompt({
      target: 'X', difficulty: 'standard', messages: [msg('user', 'x')], reachedPhase: 'wrap-up',
    });
    expect(out).toContain('summary');
    expect(out).toContain('strengths');
    expect(out).toContain('improvements');
    expect(out).toContain('perPhase');
    expect(out).toContain('overallRating');
    expect(out).toContain('nextSteps');
    expect(out).toContain('example');
  });
});

describe('parseFeedback', () => {
  const validRaw = JSON.stringify({
    target: 'Data Analyst',
    difficulty: 'standard',
    summary: 'Solid effort with clear room to grow.',
    strengths: ['Clear intro', 'Good examples'],
    improvements: [
      {
        area: 'Use STAR structure',
        why: 'Behavioural questions need situation/action/result.',
        example: 'Instead of "I worked on a team", say "When NPS dropped 15 points..."',
      },
    ],
    perPhase: [{ phase: 'warm-up', note: 'Confident' }],
    overallRating: 'on-track',
    nextSteps: ['Practice 3 STAR answers', 'Brush up on SQL'],
  });

  it('parses a clean JSON response', () => {
    const f = parseFeedback(validRaw);
    expect(f.target).toBe('Data Analyst');
    expect(f.improvements).toHaveLength(1);
    expect(f.improvements[0].area).toBe('Use STAR structure');
    expect(f.overallRating).toBe('on-track');
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n' + validRaw + '\n```';
    const f = parseFeedback(wrapped);
    expect(f.target).toBe('Data Analyst');
  });

  it('coerces missing perPhase to empty array', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      summary: 'y', strengths: [], improvements: [{
        area: 'a', why: 'b', example: 'c',
      }],
      overallRating: 'on-track', nextSteps: [],
    });
    const f = parseFeedback(raw);
    expect(f.perPhase).toEqual([]);
  });

  it('coerces invalid overallRating to on-track', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      summary: 'y', strengths: [], improvements: [{
        area: 'a', why: 'b', example: 'c',
      }],
      overallRating: 'not-a-rating', nextSteps: [],
    });
    const f = parseFeedback(raw);
    expect(f.overallRating).toBe('on-track');
  });

  it('throws when summary is missing', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      strengths: [], improvements: [{ area: 'a', why: 'b', example: 'c' }],
      overallRating: 'on-track', nextSteps: [],
    });
    expect(() => parseFeedback(raw)).toThrow();
  });

  it('throws when improvements is empty', () => {
    const raw = JSON.stringify({
      target: 'X', difficulty: 'standard',
      summary: 'y', strengths: [], improvements: [],
      overallRating: 'on-track', nextSteps: [],
    });
    expect(() => parseFeedback(raw)).toThrow();
  });

  it('preserves area, why, and example on each improvement', () => {
    const f = parseFeedback(validRaw);
    expect(f.improvements[0].area).toBeTruthy();
    expect(f.improvements[0].why).toBeTruthy();
    expect(f.improvements[0].example).toBeTruthy();
  });
});
