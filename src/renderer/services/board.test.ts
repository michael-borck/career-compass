import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateBoardReview } from './board';
import type { BoardInput } from '@/lib/prompts/board';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_BOARD_JSON = JSON.stringify({
  voices: [
    {
      role: 'recruiter',
      name: 'The Recruiter',
      response: 'Strong technical foundations, but the resume needs a clearer headline.',
    },
    {
      role: 'hr',
      name: 'The HR Partner',
      response: 'Watch the gap between projects — be ready to explain it warmly.',
    },
    {
      role: 'manager',
      name: 'The Hiring Manager',
      response: 'I want concrete outcomes. What did your work change?',
    },
    {
      role: 'mentor',
      name: 'The Mentor',
      response: 'You undersell yourself. Lead with the impact, not the tools.',
    },
  ],
  synthesis: {
    agreements: ['Profile shows real technical depth.'],
    disagreements: ['Recruiter wants pitch; manager wants metrics.'],
    topPriorities: ['Rewrite the summary line.', 'Add one outcome metric per role.'],
  },
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

const BASE_INPUT: BoardInput = {
  framing: 'I want to break into data analytics.',
  focusRole: 'Graduate data analyst',
  resume: 'BSc Computer Science. Internship at Acme.',
};

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateBoardReview — input handling', () => {
  it('rejects when no profile material is provided', async () => {
    await expect(
      generateBoardReview({ framing: 'help', focusRole: null })
    ).rejects.toThrow(/needs at least a resume/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts a resume alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));
    const result = await generateBoardReview({
      framing: '',
      focusRole: null,
      resume: 'My resume content.',
    });
    expect(result.review.voices).toHaveLength(4);
  });

  it('accepts freeText alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));
    const result = await generateBoardReview({
      framing: '',
      focusRole: null,
      freeText: 'I have a CS degree and like data.',
    });
    expect(result.review.synthesis.topPriorities.length).toBeGreaterThan(0);
  });

  it('accepts a distilledProfile alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));
    const result = await generateBoardReview({
      framing: '',
      focusRole: null,
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['get a job'],
      },
    });
    expect(result.review.voices).toHaveLength(4);
  });
});

describe('generateBoardReview — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));
    await generateBoardReview(BASE_INPUT);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/Board of Advisors/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
  });

  it('includes framing, focus role, resume, and freeText in the user prompt', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));
    await generateBoardReview({
      framing: 'Worried my degree is too academic.',
      focusRole: 'Data analyst',
      resume: 'Worked at Acme Corp doing QA.',
      freeText: 'I love testing things.',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('too academic');
    expect(userPrompt).toContain('Data analyst');
    expect(userPrompt).toContain('Acme Corp');
    expect(userPrompt).toContain('love testing');
  });
});

describe('generateBoardReview — output shape', () => {
  it('returns review + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));
    const result = await generateBoardReview(BASE_INPUT);
    expect(result.trimmed).toBe(false);
    expect(result.review.framing).toBe(BASE_INPUT.framing);
    expect(result.review.focusRole).toBe(BASE_INPUT.focusRole);
    expect(result.review.voices).toHaveLength(4);
    expect(result.review.voices.map((v) => v.role)).toEqual([
      'recruiter',
      'hr',
      'manager',
      'mentor',
    ]);
    expect(result.review.synthesis.agreements.length).toBeGreaterThan(0);
  });

  it('throws a clear error when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(generateBoardReview(BASE_INPUT)).rejects.toThrow();
  });

  it('throws when a required role is missing from voices', async () => {
    const incomplete = JSON.stringify({
      voices: [
        { role: 'recruiter', name: 'r', response: 'x' },
        { role: 'hr', name: 'h', response: 'x' },
        { role: 'manager', name: 'm', response: 'x' },
      ],
      synthesis: { agreements: ['a'], disagreements: [], topPriorities: [] },
    });
    mockChat.mockResolvedValueOnce(chatReply(incomplete));
    await expect(generateBoardReview(BASE_INPUT)).rejects.toThrow(/missing role mentor/);
  });
});

describe('generateBoardReview — token-limit retry chain', () => {
  it('retries with trimmed advert on first token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));

    const input: BoardInput = {
      ...BASE_INPUT,
      jobAdvert: longAdvert,
    };
    const result = await generateBoardReview(input);
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    // The 5000-A run should not appear; trim is at 4000.
    expect(secondPrompt).not.toMatch(/A{5000}/);
  });

  it('retries with trimmed resume on second token-limit error', async () => {
    const longResume = 'R'.repeat(5000);
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context length'))
      .mockResolvedValueOnce(chatReply(VALID_BOARD_JSON));

    const result = await generateBoardReview({
      ...BASE_INPUT,
      resume: longResume,
      jobAdvert: longAdvert,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);
    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('maximum context length'));
    await expect(
      generateBoardReview({
        ...BASE_INPUT,
        resume: 'R'.repeat(5000),
        jobAdvert: 'A'.repeat(5000),
      })
    ).rejects.toThrow(/too long for the board to review/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(generateBoardReview(BASE_INPUT)).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
