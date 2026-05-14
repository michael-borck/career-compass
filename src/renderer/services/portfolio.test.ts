import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generatePortfolio } from './portfolio';
import type { PortfolioInput } from './portfolio';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Jane Doe</title></head>
<body><h1>Jane Doe</h1><p>Final-year CS student.</p></body>
</html>`;

const FRAGMENT_HTML = `<h1>Jane Doe</h1>\n<p>Final-year CS student.</p>`;

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generatePortfolio — validation', () => {
  it('throws when no profile signal is provided', async () => {
    await expect(generatePortfolio({})).rejects.toThrow(/resume or About you/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only resume and freeText as empty', async () => {
    await expect(
      generatePortfolio({ resume: '   ', freeText: '\n\t  ' })
    ).rejects.toThrow(/resume or About you/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts a resume alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({ resume: 'Jane Doe — final-year CS student.' });
    expect(result.portfolio.html).toMatch(/<!DOCTYPE html>/);
  });

  it('accepts freeText alone (no resume)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({ freeText: 'I am a designer turning to engineering.' });
    expect(result.portfolio.html).toBeTruthy();
  });

  it('accepts a distilledProfile alone (no resume or freeText)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({
      distilledProfile: {
        background: 'CS undergrad',
        interests: ['analytics'],
        skills: ['python'],
        constraints: [],
        goals: ['data role'],
      },
    });
    expect(result.portfolio.html).toBeTruthy();
  });
});

describe('generatePortfolio — prompt construction', () => {
  it('sends a system prompt + user prompt (no response_format — HTML output)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    await generatePortfolio({ resume: 'Some resume text.' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    // HTML output → no json_object response_format.
    expect(args.response_format).toBeUndefined();
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/HTML/);
    expect(args.messages[0].content).toMatch(/no code fences/i);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Some resume text/);
  });

  it('includes jobTitle and jobAdvert in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    await generatePortfolio({
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

describe('generatePortfolio — output shape', () => {
  it('returns the full HTML document untouched when the model produces one', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({ resume: 'Some resume.' });
    expect(result.portfolio.html).toBe(FULL_HTML);
  });

  it('wraps an HTML fragment in a minimal document shell', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FRAGMENT_HTML));
    const result = await generatePortfolio({ resume: 'Some resume.' });
    expect(result.portfolio.html).toMatch(/^<!DOCTYPE html>/);
    expect(result.portfolio.html).toContain('<h1>Jane Doe</h1>');
    expect(result.portfolio.html).toContain('<body>');
  });

  it('strips ```html fences from the model output', async () => {
    const fenced = '```html\n' + FULL_HTML + '\n```';
    mockChat.mockResolvedValueOnce(chatReply(fenced));
    const result = await generatePortfolio({ resume: 'Some resume.' });
    expect(result.portfolio.html).toBe(FULL_HTML);
    expect(result.portfolio.html).not.toMatch(/```/);
  });

  it('strips bare ``` fences from the model output', async () => {
    const fenced = '```\n' + FULL_HTML + '\n```';
    mockChat.mockResolvedValueOnce(chatReply(fenced));
    const result = await generatePortfolio({ resume: 'Some resume.' });
    expect(result.portfolio.html).toBe(FULL_HTML);
  });

  it('sets target from jobTitle (trimmed) when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({
      resume: 'Some resume.',
      jobTitle: '  Data analyst  ',
    });
    expect(result.portfolio.target).toBe('Data analyst');
  });

  it('falls back to first line of jobAdvert when no jobTitle', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({
      resume: 'Some resume.',
      jobAdvert: 'Senior Designer at Acme\nWe are looking for a great designer.',
    });
    expect(result.portfolio.target).toBe('Senior Designer at Acme');
  });

  it('truncates a long jobAdvert first-line target to 60 chars', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const longLine = 'A'.repeat(80);
    const result = await generatePortfolio({
      resume: 'Some resume.',
      jobAdvert: longLine,
    });
    expect(result.portfolio.target).toHaveLength(60);
  });

  it('sets target to null when neither jobTitle nor jobAdvert is provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({ resume: 'Some resume.' });
    expect(result.portfolio.target).toBeNull();
  });

  it('returns trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(FULL_HTML));
    const result = await generatePortfolio({ resume: 'Some resume.' });
    expect(result.trimmed).toBe(false);
  });
});

describe('generatePortfolio — token-limit retry', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(FULL_HTML));

    const result = await generatePortfolio({
      resume: 'Short resume.',
      jobAdvert: longAdvert,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).toMatch(/A{4000}/);
    expect(secondPrompt).not.toMatch(/A{5000}/);
  });

  it('retries again with trimmed resume after advert trim still fails', async () => {
    const longAdvert = 'A'.repeat(5000);
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('maximum context'))
      .mockRejectedValueOnce(new Error('reduce the length'))
      .mockResolvedValueOnce(chatReply(FULL_HTML));

    const result = await generatePortfolio({
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
      generatePortfolio({
        resume: 'R'.repeat(5000),
        jobAdvert: 'A'.repeat(5000),
      })
    ).rejects.toThrow(/too long for a portfolio page/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    const input: PortfolioInput = { resume: 'Short resume.' };
    await expect(generatePortfolio(input)).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
