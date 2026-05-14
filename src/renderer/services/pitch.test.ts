import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generatePitch } from './pitch';
import type { PitchInput } from '@/lib/prompts/pitch';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_PITCH_JSON = JSON.stringify({
  hook: 'I am a curious student of data.',
  body: 'I love finding patterns in messy datasets and turning them into stories anyone can follow.',
  close: 'I am looking for a data-analyst role where I can keep learning.',
  fullScript: 'I am a curious student of data. I love finding patterns... I am looking for a data-analyst role.',
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generatePitch — validation', () => {
  it('throws when no input fields are provided', async () => {
    await expect(generatePitch({})).rejects.toThrow(/at least one input field/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only strings as empty', async () => {
    const input: PitchInput = {
      resume: '   ',
      freeText: '\n\t',
      jobTitle: ' ',
      jobAdvert: '',
    };
    await expect(generatePitch(input)).rejects.toThrow(/at least one input field/i);
  });

  it('accepts a distilledProfile alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    const result = await generatePitch({
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['get a job'],
      },
    });
    expect(result.pitch.hook).toContain('curious');
  });
});

describe('generatePitch — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    await generatePitch({ jobTitle: 'Data analyst' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/elevator pitch/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    // The user prompt should contain the target role
    expect(args.messages[1].content).toMatch(/Data analyst/);
  });

  it('includes resume, freeText, and jobAdvert in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    await generatePitch({
      resume: 'Worked at Acme Corp doing QA.',
      freeText: 'I love testing.',
      jobAdvert: 'We are hiring a junior QA engineer.',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Acme Corp');
    expect(userPrompt).toContain('love testing');
    expect(userPrompt).toContain('hiring a junior QA');
  });
});

describe('generatePitch — output shape', () => {
  it('derives target from jobTitle when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    const result = await generatePitch({ jobTitle: '  Data analyst  ' });
    expect(result.pitch.target).toBe('Data analyst');
  });

  it('derives target from first line of jobAdvert when no jobTitle', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    const result = await generatePitch({
      jobAdvert: 'Senior UX Designer\nAt our company...',
    });
    expect(result.pitch.target).toBe('Senior UX Designer');
  });

  it('uses null target when only resume/freeText supplied', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    const result = await generatePitch({ freeText: 'I am a student.' });
    expect(result.pitch.target).toBeNull();
  });

  it('returns parsed pitch + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));
    const result = await generatePitch({ jobTitle: 'Analyst' });
    expect(result.trimmed).toBe(false);
    expect(result.pitch.hook).toBeTruthy();
    expect(result.pitch.body).toBeTruthy();
    expect(result.pitch.close).toBeTruthy();
    expect(result.pitch.fullScript).toBeTruthy();
  });
});

describe('generatePitch — token-limit retry', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));

    const result = await generatePitch({ jobAdvert: longAdvert });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    // Second call's user prompt should not contain the full 5000-char advert
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    const advertOccurrences = (secondPrompt.match(/A{4000}/g) ?? []).length;
    expect(advertOccurrences).toBeGreaterThan(0);
    // No 5000-char run should appear
    expect(secondPrompt).not.toMatch(/A{5000}/);
  });

  it('retries again with trimmed resume after advert trim still fails', async () => {
    const longAdvert = 'A'.repeat(5000);
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('maximum context'))
      .mockRejectedValueOnce(new Error('reduce the length'))
      .mockResolvedValueOnce(chatReply(VALID_PITCH_JSON));

    const result = await generatePitch({
      jobAdvert: longAdvert,
      resume: longResume,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);
    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat
      .mockRejectedValue(new Error('token limit exceeded'));

    await expect(
      generatePitch({
        resume: 'R'.repeat(5000),
        jobAdvert: 'A'.repeat(5000),
      })
    ).rejects.toThrow(/too long for the model/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generatePitch({ jobTitle: 'Analyst' })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
