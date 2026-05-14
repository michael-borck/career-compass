import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client and the search module before importing the service.
// The service imports `chat` from './llm' and `search` / `loadSearchSettings` /
// `isSearchConfigured` from './search'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

vi.mock('./search', () => ({
  search: vi.fn(),
  loadSearchSettings: vi.fn(),
  isSearchConfigured: vi.fn(),
}));

import { chat } from './llm';
import { search, loadSearchSettings, isSearchConfigured } from './search';
import { generateGapAnalysis } from './gapAnalysis';
import type { SourceRef } from '@/lib/session-store';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;
const mockSearch = search as unknown as ReturnType<typeof vi.fn>;
const mockLoadSearchSettings =
  loadSearchSettings as unknown as ReturnType<typeof vi.fn>;
const mockIsSearchConfigured =
  isSearchConfigured as unknown as ReturnType<typeof vi.fn>;

const VALID_GAP_JSON = JSON.stringify({
  target: 'Data Analyst',
  summary: 'You have a strong analytical base. With SQL and a portfolio piece you would be a competitive candidate.',
  matches: ['Comfortable with Python', 'Statistics coursework'],
  gaps: [
    {
      title: 'SQL fluency',
      category: 'technical',
      severity: 'critical',
      why: 'Every data-analyst job interview includes SQL.',
      targetLevel: 'Joins, subqueries, window functions',
      currentLevel: 'Basic SELECT only',
      evidenceIdeas: ['Build a small analytics project that requires joins'],
    },
  ],
  realisticTimeline: '3-6 months with focused effort',
});

const VALID_INPUT = {
  jobTitle: 'Data analyst',
  aboutYou: 'CS student with Python and stats coursework.',
};

const DDG_SOURCES: SourceRef[] = [
  { title: 'Data Analyst Salary Guide', url: 'https://example.com/salary', domain: 'example.com' },
  { title: 'Top Skills for Data Analysts', url: 'https://example.com/skills', domain: 'example.com' },
];

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
  mockSearch.mockReset();
  mockLoadSearchSettings.mockReset();
  mockIsSearchConfigured.mockReset();
  // Default: search is not configured, so no search is run by default.
  mockLoadSearchSettings.mockResolvedValue({
    engine: 'disabled',
    apiKey: '',
    url: '',
  });
  mockIsSearchConfigured.mockReturnValue(false);
});

describe('generateGapAnalysis — validation', () => {
  it('throws when no target is provided', async () => {
    await expect(
      generateGapAnalysis({ aboutYou: 'CS student' })
    ).rejects.toThrow(/target is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('throws when no profile is provided', async () => {
    await expect(
      generateGapAnalysis({ jobTitle: 'Data analyst' })
    ).rejects.toThrow(/profile is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only target as missing', async () => {
    await expect(
      generateGapAnalysis({ jobTitle: '   ', aboutYou: 'CS student' })
    ).rejects.toThrow(/target is required/i);
  });

  it('accepts a distilledProfile alone as profile', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    const result = await generateGapAnalysis({
      jobTitle: 'Data analyst',
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['get a job'],
      },
    });
    expect(result.analysis.target).toBe('Data Analyst');
  });
});

describe('generateGapAnalysis — search integration', () => {
  it('does not call search when grounded is false', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    await generateGapAnalysis({ ...VALID_INPUT, grounded: false });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockLoadSearchSettings).not.toHaveBeenCalled();
  });

  it('does not call search when grounded is omitted', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    await generateGapAnalysis(VALID_INPUT);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not call search when search is not configured', async () => {
    mockIsSearchConfigured.mockReturnValue(false);
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    const result = await generateGapAnalysis({ ...VALID_INPUT, grounded: true });

    expect(mockLoadSearchSettings).toHaveBeenCalledTimes(1);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.groundingFailed).toBe(false);
    // LLM call still proceeds with no sources.
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('calls search when grounded and search is configured, passing results into the prompt', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce(DDG_SOURCES);
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));

    const result = await generateGapAnalysis({ ...VALID_INPUT, grounded: true });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const searchArgs = mockSearch.mock.calls[0][0];
    expect(searchArgs.query).toMatch(/Data analyst/);
    expect(searchArgs.query).toMatch(/salary skills requirements/);
    expect(searchArgs.intent).toBe('salary');

    // Sources should be reflected in the result.
    expect(result.sources).toEqual(DDG_SOURCES);
    expect(result.groundingFailed).toBe(false);

    // Sources should appear inside the LLM user prompt.
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Data Analyst Salary Guide');
    expect(userPrompt).toContain('example.com');
  });

  it('derives search query from first line of jobAdvert when no jobTitle', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce([]);
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));

    await generateGapAnalysis({
      jobAdvert: 'Senior UX Researcher\nWe are looking for...',
      aboutYou: 'Student',
      grounded: true,
    });

    const searchArgs = mockSearch.mock.calls[0][0];
    expect(searchArgs.query).toMatch(/Senior UX Researcher/);
  });

  it('falls back to "this role" placeholder when neither jobTitle nor advert has useful text', async () => {
    // Edge case: jobTitle is whitespace but jobAdvert exists (passes validation).
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce([]);
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));

    await generateGapAnalysis({
      jobAdvert: 'Senior UX Researcher\nDetails follow.',
      aboutYou: 'Student',
      grounded: true,
    });

    // jobAdvert path: the query should use the first line.
    const searchArgs = mockSearch.mock.calls[0][0];
    expect(searchArgs.query).toMatch(/Senior UX Researcher/);
  });

  it('swallows search errors and proceeds with no sources (groundingFailed=true)', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockRejectedValueOnce(new Error('network down'));
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));

    const result = await generateGapAnalysis({ ...VALID_INPUT, grounded: true });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.sources).toEqual([]);
    expect(result.groundingFailed).toBe(true);
    expect(result.analysis.target).toBe('Data Analyst');
  });
});

describe('generateGapAnalysis — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    await generateGapAnalysis(VALID_INPUT);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/gap analyst/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Data analyst/);
  });

  it('includes resume, aboutYou, and jobAdvert in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    await generateGapAnalysis({
      resume: 'Worked at Acme Corp doing QA.',
      aboutYou: 'I love testing.',
      jobAdvert: 'We are hiring a junior QA engineer.',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Acme Corp');
    expect(userPrompt).toContain('love testing');
    expect(userPrompt).toContain('hiring a junior QA');
  });
});

describe('generateGapAnalysis — output shape', () => {
  it('returns parsed analysis + sources + trimmed=false + groundingFailed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_GAP_JSON));
    const result = await generateGapAnalysis(VALID_INPUT);
    expect(result.trimmed).toBe(false);
    expect(result.groundingFailed).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.analysis.target).toBe('Data Analyst');
    expect(result.analysis.summary).toBeTruthy();
    expect(result.analysis.matches).toHaveLength(2);
    expect(result.analysis.gaps).toHaveLength(1);
    expect(result.analysis.gaps[0].title).toBe('SQL fluency');
    expect(result.analysis.realisticTimeline).toBe('3-6 months with focused effort');
  });
});

describe('generateGapAnalysis — token-limit retry', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_GAP_JSON));

    const result = await generateGapAnalysis({
      jobAdvert: longAdvert,
      aboutYou: 'Student',
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).toMatch(/A{4000}/);
    expect(secondPrompt).not.toMatch(/A{5000}/);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(generateGapAnalysis(VALID_INPUT)).rejects.toThrow(
      /API key not configured/
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('propagates token-limit error if the trimmed retry also fails with a token-limit error', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context'));

    await expect(
      generateGapAnalysis({
        jobAdvert: 'A'.repeat(5000),
        aboutYou: 'Student',
      })
    ).rejects.toThrow(/maximum context/);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
