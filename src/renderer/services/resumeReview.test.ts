import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateResumeReview } from './resumeReview';
import type { ResumeReviewInput } from '@/lib/prompts/resume-review';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_REVIEW_JSON = JSON.stringify({
  overallImpression:
    'A solid early-career resume that shows technical breadth. Tightening the bullets and adding measurable impact would lift it considerably.',
  strengths: [
    'Clear chronology and consistent formatting.',
    'Good mix of coursework and internships.',
  ],
  improvements: [
    {
      section: 'Summary',
      suggestion: 'Lead with a one-line value proposition.',
      why: 'Recruiters scan the top five lines before deciding to read on.',
      example: 'Final-year CS student with two analytics internships and a focus on Python tooling.',
    },
    {
      section: 'Work Experience',
      suggestion: 'Quantify outcomes wherever possible.',
      why: 'Numbers make impact concrete and memorable.',
      example: 'Built a Python pipeline that cut weekly reporting time from 6h to 30m.',
    },
    {
      section: 'Skills',
      suggestion: 'Group skills by category instead of one long list.',
      why: 'A categorised list is easier to skim and reads as more deliberate.',
      example: 'Languages: Python, TypeScript. Tools: Git, Docker. Data: Pandas, SQL.',
    },
  ],
  keywordsToAdd: ['SQL', 'data pipelines'],
  structuralNotes: ['Move Education below Experience now that you have two internships.'],
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateResumeReview — validation', () => {
  it('throws when no resume is provided', async () => {
    await expect(generateResumeReview({ resume: '' })).rejects.toThrow(
      /resume is required/i
    );
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only resume as empty', async () => {
    await expect(
      generateResumeReview({ resume: '   \n\t  ' })
    ).rejects.toThrow(/resume is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts a resume alone (no jobTitle/jobAdvert)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));
    const result = await generateResumeReview({
      resume: 'Jane Doe\nFinal-year CS student.\nInternship at Acme.',
    });
    expect(result.review.overallImpression).toBeTruthy();
    expect(result.review.improvements.length).toBeGreaterThan(0);
  });
});

describe('generateResumeReview — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));
    await generateResumeReview({ resume: 'Some resume text.' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/resume/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Some resume text/);
  });

  it('includes jobTitle and jobAdvert in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));
    await generateResumeReview({
      resume: 'Worked at Acme Corp.',
      jobTitle: 'Data analyst',
      jobAdvert: 'We are hiring a junior data analyst.',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Acme Corp');
    expect(userPrompt).toContain('Data analyst');
    expect(userPrompt).toContain('hiring a junior data analyst');
  });
});

describe('generateResumeReview — output shape', () => {
  it('sets target from jobTitle (trimmed) when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));
    const result = await generateResumeReview({
      resume: 'Some resume.',
      jobTitle: '  Data analyst  ',
    });
    expect(result.review.target).toBe('Data analyst');
  });

  it('sets target to null when no jobTitle is provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));
    const result = await generateResumeReview({ resume: 'Some resume.' });
    expect(result.review.target).toBeNull();
  });

  it('returns parsed review + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));
    const result = await generateResumeReview({ resume: 'Some resume.' });
    expect(result.trimmed).toBe(false);
    expect(result.review.overallImpression).toBeTruthy();
    expect(result.review.strengths.length).toBeGreaterThan(0);
    expect(result.review.improvements.length).toBe(3);
    expect(result.review.keywordsToAdd).toContain('SQL');
    expect(result.review.structuralNotes.length).toBeGreaterThan(0);
  });
});

describe('generateResumeReview — token-limit retry', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));

    const result = await generateResumeReview({
      resume: 'Short resume.',
      jobAdvert: longAdvert,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    // The trimmed advert should be 4000 chars long, not 5000.
    expect(secondPrompt).toMatch(/A{4000}/);
    expect(secondPrompt).not.toMatch(/A{5000}/);
  });

  it('retries again with trimmed resume after advert trim still fails', async () => {
    const longAdvert = 'A'.repeat(5000);
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('maximum context'))
      .mockRejectedValueOnce(new Error('reduce the length'))
      .mockResolvedValueOnce(chatReply(VALID_REVIEW_JSON));

    const result = await generateResumeReview({
      resume: longResume,
      jobAdvert: longAdvert,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);
    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('token limit exceeded'));

    await expect(
      generateResumeReview({
        resume: 'R'.repeat(5000),
        jobAdvert: 'A'.repeat(5000),
      })
    ).rejects.toThrow(/too long for the model/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    const input: ResumeReviewInput = { resume: 'Short resume.' };
    await expect(generateResumeReview(input)).rejects.toThrow(
      /API key not configured/
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
