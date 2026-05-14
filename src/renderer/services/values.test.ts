import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateValuesCompass } from './values';
import type { ValuesInput } from '@/lib/prompts/values';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_VALUES_JSON = JSON.stringify({
  summary: 'You value learning and impact most, with a steady pull toward autonomy and creativity.',
  values: [
    {
      name: 'Learning',
      rank: 1,
      description: 'You light up when you can keep growing.',
      evidence: 'Your profile mentions teaching yourself new tools repeatedly.',
      reflectionQuestion: 'What is the last thing that genuinely challenged you?',
    },
    {
      name: 'Impact',
      rank: 2,
      description: 'You want your work to matter to someone.',
      evidence: 'You wrote about wanting work to feel meaningful.',
      reflectionQuestion: 'Whose life would you most want to change?',
    },
    {
      name: 'Autonomy',
      rank: 3,
      description: 'You need room to make your own calls.',
      evidence: 'Implicit from the focus-time comment.',
      reflectionQuestion: 'When was the last time micromanagement burned you out?',
    },
  ],
  tensions: [
    'You value both autonomy and teamwork — worth exploring how you balance solo focus with collaboration.',
    'Learning and stability can pull in different directions early in a career.',
  ],
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateValuesCompass — input handling', () => {
  it('accepts an entirely empty input (legacy is permissive)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));
    const result = await generateValuesCompass({});
    expect(result.compass.summary).toBeTruthy();
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('accepts a valuesSeed alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));
    const result = await generateValuesCompass({
      valuesSeed: 'I want work that feels meaningful.',
    });
    expect(result.compass.values.length).toBeGreaterThan(0);
  });

  it('accepts a distilledProfile alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));
    const result = await generateValuesCompass({
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['get a job'],
      },
    });
    expect(result.compass.summary).toBeTruthy();
  });
});

describe('generateValuesCompass — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));
    await generateValuesCompass({ valuesSeed: 'meaningful work' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/values coach/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/meaningful work/);
  });

  it('includes resume, aboutYou, and valuesSeed in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));
    await generateValuesCompass({
      resume: 'Worked at Acme Corp doing QA.',
      aboutYou: 'I love testing.',
      valuesSeed: 'I want creative freedom.',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Acme Corp');
    expect(userPrompt).toContain('love testing');
    expect(userPrompt).toContain('creative freedom');
  });
});

describe('generateValuesCompass — output shape', () => {
  it('returns parsed compass + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));
    const result = await generateValuesCompass({ valuesSeed: 'meaning' });
    expect(result.trimmed).toBe(false);
    expect(result.compass.summary).toBeTruthy();
    expect(result.compass.values.length).toBeGreaterThan(0);
    expect(result.compass.tensions.length).toBeGreaterThan(0);
  });

  it('sorts values by rank ascending', async () => {
    const reordered = JSON.stringify({
      summary: 'Test summary.',
      values: [
        { name: 'Third', rank: 3, description: 'd', evidence: 'e', reflectionQuestion: 'r' },
        { name: 'First', rank: 1, description: 'd', evidence: 'e', reflectionQuestion: 'r' },
        { name: 'Second', rank: 2, description: 'd', evidence: 'e', reflectionQuestion: 'r' },
      ],
      tensions: [],
    });
    mockChat.mockResolvedValueOnce(chatReply(reordered));
    const result = await generateValuesCompass({ valuesSeed: 'test' });
    expect(result.compass.values.map((v) => v.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('throws a clear error when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(generateValuesCompass({ valuesSeed: 'x' })).rejects.toThrow();
  });
});

describe('generateValuesCompass — token-limit retry', () => {
  it('retries once with trimmed resume on token-limit error', async () => {
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_VALUES_JSON));

    const input: ValuesInput = { resume: longResume };
    const result = await generateValuesCompass(input);
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after two token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('maximum context length'));
    await expect(
      generateValuesCompass({ resume: 'R'.repeat(5000) })
    ).rejects.toThrow(/too long for the model/i);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generateValuesCompass({ valuesSeed: 'test' })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
