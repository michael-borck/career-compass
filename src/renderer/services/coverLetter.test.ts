import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateCoverLetter } from './coverLetter';
import type { CoverLetterInput } from '@/lib/prompts/cover-letter';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_LETTER_JSON = JSON.stringify({
  greeting: 'Dear Hiring Manager,',
  body: 'I am writing to apply for the role.\n\nMy experience includes building things and solving problems.\n\nI would welcome the opportunity to discuss further.',
  closing: 'Sincerely,\n[Your Name]',
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateCoverLetter — validation', () => {
  it('throws when no jobTitle or jobAdvert is provided', async () => {
    await expect(generateCoverLetter({})).rejects.toThrow(
      /job title or job advert/i
    );
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('throws when only resume/freeText/profile are provided (no target)', async () => {
    const input: CoverLetterInput = {
      resume: 'Worked at Acme Corp.',
      freeText: 'I love testing.',
    };
    await expect(generateCoverLetter(input)).rejects.toThrow(
      /job title or job advert/i
    );
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only target strings as empty', async () => {
    const input: CoverLetterInput = {
      jobTitle: '   ',
      jobAdvert: '\n\t',
    };
    await expect(generateCoverLetter(input)).rejects.toThrow(
      /job title or job advert/i
    );
  });

  it('accepts a jobTitle alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    const result = await generateCoverLetter({ jobTitle: 'Data analyst' });
    expect(result.letter.greeting).toContain('Dear');
  });

  it('accepts a jobAdvert alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    const result = await generateCoverLetter({
      jobAdvert: 'Senior UX Designer\nAt our company we hire designers.',
    });
    expect(result.letter.body).toBeTruthy();
  });
});

describe('generateCoverLetter — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    await generateCoverLetter({ jobTitle: 'Data analyst' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/cover letter/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    // The user prompt should contain the target role
    expect(args.messages[1].content).toMatch(/Data analyst/);
  });

  it('includes resume, freeText, and jobAdvert in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    await generateCoverLetter({
      jobTitle: 'QA Engineer',
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

describe('generateCoverLetter — output shape', () => {
  it('derives target from jobTitle when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    const result = await generateCoverLetter({ jobTitle: '  Data analyst  ' });
    expect(result.letter.target).toBe('Data analyst');
  });

  it('derives target from first line of jobAdvert when no jobTitle', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    const result = await generateCoverLetter({
      jobAdvert: 'Senior UX Designer\nAt our company...',
    });
    expect(result.letter.target).toBe('Senior UX Designer');
  });

  it('returns parsed letter + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));
    const result = await generateCoverLetter({ jobTitle: 'Analyst' });
    expect(result.trimmed).toBe(false);
    expect(result.letter.greeting).toBeTruthy();
    expect(result.letter.body).toBeTruthy();
    expect(result.letter.closing).toBeTruthy();
    expect(result.letter.target).toBe('Analyst');
  });
});

describe('generateCoverLetter — token-limit retry', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));

    const result = await generateCoverLetter({
      jobTitle: 'Analyst',
      jobAdvert: longAdvert,
    });
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
      .mockResolvedValueOnce(chatReply(VALID_LETTER_JSON));

    const result = await generateCoverLetter({
      jobTitle: 'Analyst',
      jobAdvert: longAdvert,
      resume: longResume,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);
    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('token limit exceeded'));

    await expect(
      generateCoverLetter({
        jobTitle: 'Analyst',
        resume: 'R'.repeat(5000),
        jobAdvert: 'A'.repeat(5000),
      })
    ).rejects.toThrow(/too long for the model/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generateCoverLetter({ jobTitle: 'Analyst' })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
