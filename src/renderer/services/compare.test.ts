import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateComparison } from './compare';
import type { CompareInput } from '@/lib/prompts/compare';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_COMPARE_JSON_2 = JSON.stringify({
  roles: [
    {
      label: 'Data analyst',
      cells: {
        typicalDay: 'Mostly SQL queries and dashboards.',
        coreSkills: 'SQL, Excel, light Python.',
        trainingNeeded: 'Bootcamp or a STEM degree.',
        salaryRange: 'AUD 70-110k depending on industry.',
        workSetting: 'Small analytics teams, hybrid common.',
        whoItSuits: 'Curious people who like patterns.',
        mainChallenge: 'Cleaning messy data is most of the job.',
      },
    },
    {
      label: 'UX researcher',
      cells: {
        typicalDay: 'User interviews and synthesis.',
        coreSkills: 'Interviewing, qualitative coding, empathy.',
        trainingNeeded: 'A portfolio of 3-5 case studies.',
        salaryRange: 'AUD 80-130k at mid-level.',
        workSetting: 'Embedded in product teams.',
        whoItSuits: 'People who can hold ambiguity calmly.',
        mainChallenge: 'Persuading stakeholders to act on findings.',
      },
    },
  ],
});

const VALID_COMPARE_JSON_3 = JSON.stringify({
  roles: [
    {
      label: 'A',
      cells: {
        typicalDay: 'a',
        coreSkills: 'a',
        trainingNeeded: 'a',
        salaryRange: 'a',
        workSetting: 'a',
        whoItSuits: 'a',
        mainChallenge: 'a',
      },
    },
    {
      label: 'B',
      cells: {
        typicalDay: 'b',
        coreSkills: 'b',
        trainingNeeded: 'b',
        salaryRange: 'b',
        workSetting: 'b',
        whoItSuits: 'b',
        mainChallenge: 'b',
      },
    },
    {
      label: 'C',
      cells: {
        typicalDay: 'c',
        coreSkills: 'c',
        trainingNeeded: 'c',
        salaryRange: 'c',
        workSetting: 'c',
        whoItSuits: 'c',
        mainChallenge: 'c',
      },
    },
  ],
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

function input2(): CompareInput {
  return {
    mode: 'quick',
    targets: [{ label: 'Data analyst' }, { label: 'UX researcher' }],
  };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateComparison — input handling', () => {
  it('rejects fewer than 2 targets with a clear error', async () => {
    await expect(
      generateComparison({
        mode: 'quick',
        targets: [{ label: 'Data analyst' }],
      })
    ).rejects.toThrow(/2 or 3 targets/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects more than 3 targets with a clear error', async () => {
    await expect(
      generateComparison({
        mode: 'quick',
        targets: [
          { label: 'A' },
          { label: 'B' },
          { label: 'C' },
          { label: 'D' },
        ],
      })
    ).rejects.toThrow(/2 or 3 targets/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects targets with empty or whitespace-only labels', async () => {
    await expect(
      generateComparison({
        mode: 'quick',
        targets: [{ label: 'Data analyst' }, { label: '   ' }],
      })
    ).rejects.toThrow(/non-empty label/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts 2 targets', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));
    const result = await generateComparison(input2());
    expect(result.comparison.roles).toHaveLength(2);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('accepts 3 targets', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_3));
    const result = await generateComparison({
      mode: 'quick',
      targets: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
    });
    expect(result.comparison.roles).toHaveLength(3);
  });
});

describe('generateComparison — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));
    await generateComparison(input2());

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/structured JSON comparisons/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Data analyst/);
    expect(args.messages[1].content).toMatch(/UX researcher/);
  });

  it('includes resume, freeText, and distilledProfile in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));
    await generateComparison({
      mode: 'quick',
      targets: [{ label: 'Data analyst' }, { label: 'UX researcher' }],
      resume: 'Worked at Acme doing QA.',
      freeText: 'I love patterns.',
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['SQL'],
        constraints: [],
        goals: ['get hired'],
      },
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Acme');
    expect(userPrompt).toContain('love patterns');
    expect(userPrompt).toContain('CS student');
  });
});

describe('generateComparison — output shape', () => {
  it('returns parsed comparison + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));
    const result = await generateComparison(input2());
    expect(result.trimmed).toBe(false);
    expect(result.comparison.mode).toBe('quick');
    expect(result.comparison.roles).toHaveLength(2);
    expect(result.comparison.roles[0].label).toBe('Data analyst');
    expect(result.comparison.roles[0].cells.typicalDay).toBeTruthy();
    expect(result.comparison.roles[1].label).toBe('UX researcher');
  });

  it('preserves mode=rich through to the parsed comparison', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));
    const result = await generateComparison({
      ...input2(),
      mode: 'rich',
    });
    expect(result.comparison.mode).toBe('rich');
  });

  it('throws a clear error when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(generateComparison(input2())).rejects.toThrow();
  });
});

describe('generateComparison — token-limit retry', () => {
  it('retries once with trimmed target labels on token-limit error', async () => {
    const longLabel = 'L'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));

    const result = await generateComparison({
      mode: 'quick',
      targets: [{ label: longLabel }, { label: 'UX researcher' }],
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).not.toMatch(/L{5000}/);
  });

  it('retries a second time with trimmed resume when target-trim still fails', async () => {
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context length'))
      .mockResolvedValueOnce(chatReply(VALID_COMPARE_JSON_2));

    const result = await generateComparison({
      mode: 'quick',
      targets: [{ label: 'Data analyst' }, { label: 'UX researcher' }],
      resume: longResume,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);
    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('maximum context length'));
    await expect(
      generateComparison({
        mode: 'quick',
        targets: [{ label: 'Data analyst' }, { label: 'UX researcher' }],
        resume: 'R'.repeat(5000),
      })
    ).rejects.toThrow(/too long to run together/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(generateComparison(input2())).rejects.toThrow(
      /API key not configured/
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
