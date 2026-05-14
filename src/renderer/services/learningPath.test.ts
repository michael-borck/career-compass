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
import { generateLearningPath } from './learningPath';
import type { GapAnalysis, SourceRef } from '@/lib/session-store';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;
const mockSearch = search as unknown as ReturnType<typeof vi.fn>;
const mockLoadSearchSettings =
  loadSearchSettings as unknown as ReturnType<typeof vi.fn>;
const mockIsSearchConfigured =
  isSearchConfigured as unknown as ReturnType<typeof vi.fn>;

const VALID_PATH_JSON = JSON.stringify({
  target: 'Data Analyst',
  summary:
    'A 12-week path that builds SQL fluency, a portfolio piece, and interview readiness.',
  prerequisites: ['Basic Python', 'Comfort with spreadsheets'],
  milestones: [
    {
      weekRange: 'Weeks 1-2',
      focus: 'SQL fundamentals',
      activities: ['Complete an intermediate SQL course', 'Practice on a sample dataset'],
      outcome: 'Comfortable with joins, subqueries, and window functions',
    },
    {
      weekRange: 'Weeks 3-6',
      focus: 'Portfolio analysis project',
      activities: ['Pick a public dataset', 'Write up findings'],
      outcome: 'Published portfolio piece on GitHub',
    },
  ],
  portfolioProject:
    'End-to-end analysis of a public dataset, presented in a short report.',
  totalDuration: '12 weeks part-time',
  caveats: [
    'AI cannot recommend specific course URLs — verify before buying.',
    'Timeline assumes ~10 hrs/week.',
  ],
});

const VALID_INPUT = {
  jobTitle: 'Data analyst',
  aboutYou: 'CS student with Python and stats coursework.',
};

const DDG_SOURCES: SourceRef[] = [
  { title: 'Data Analyst Learning Path', url: 'https://example.com/path', domain: 'example.com' },
  { title: 'Best SQL Courses 2026', url: 'https://example.com/sql', domain: 'example.com' },
];

const GAP_ANALYSIS: GapAnalysis = {
  target: 'Data Analyst',
  summary: 'Strong base, missing SQL and a portfolio piece.',
  matches: ['Python', 'Statistics'],
  gaps: [
    {
      title: 'SQL fluency',
      category: 'technical',
      severity: 'critical',
      why: 'Every data-analyst interview includes SQL.',
      targetLevel: 'Joins, subqueries, window functions',
      currentLevel: 'Basic SELECT only',
      evidenceIdeas: ['Portfolio query notebook'],
    },
    {
      title: 'Dashboarding',
      category: 'technical',
      severity: 'critical',
      why: 'Common stakeholder deliverable.',
      targetLevel: 'Tableau or PowerBI fluency',
      currentLevel: 'None',
      evidenceIdeas: ['Published dashboard'],
    },
    {
      title: 'Public portfolio',
      category: 'experience',
      severity: 'critical',
      why: 'Hiring managers ask for examples.',
      targetLevel: '1-2 polished projects',
      currentLevel: 'None',
      evidenceIdeas: ['GitHub repo'],
    },
    {
      title: 'Stakeholder writing',
      category: 'soft',
      severity: 'important',
      why: 'Reports go to non-technical readers.',
      targetLevel: 'Plain-English summaries',
      currentLevel: 'Academic style',
      evidenceIdeas: ['Sample executive summary'],
    },
  ],
  realisticTimeline: '3-6 months',
};

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

describe('generateLearningPath — validation', () => {
  it('throws when no target is provided', async () => {
    await expect(
      generateLearningPath({ aboutYou: 'CS student' })
    ).rejects.toThrow(/target is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only target as missing', async () => {
    await expect(
      generateLearningPath({ jobTitle: '   ', aboutYou: 'CS student' })
    ).rejects.toThrow(/target is required/i);
  });

  it('accepts a target with no profile (profile is optional for learning path)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    const result = await generateLearningPath({ jobTitle: 'Data analyst' });
    expect(result.path.target).toBe('Data Analyst');
  });
});

describe('generateLearningPath — search integration', () => {
  it('does not call search when grounded is false', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    await generateLearningPath({ ...VALID_INPUT, grounded: false });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockLoadSearchSettings).not.toHaveBeenCalled();
  });

  it('does not call search when grounded is omitted', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    await generateLearningPath(VALID_INPUT);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not call search when search is not configured', async () => {
    mockIsSearchConfigured.mockReturnValue(false);
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    const result = await generateLearningPath({ ...VALID_INPUT, grounded: true });

    expect(mockLoadSearchSettings).toHaveBeenCalledTimes(1);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.groundingFailed).toBe(false);
    // LLM call still proceeds with no sources.
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('uses generic courses/certifications query when no gap analysis is provided', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce(DDG_SOURCES);
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));

    const result = await generateLearningPath({ ...VALID_INPUT, grounded: true });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const searchArgs = mockSearch.mock.calls[0][0];
    expect(searchArgs.query).toMatch(/Data analyst/);
    expect(searchArgs.query).toMatch(/learning path courses certifications/);
    expect(searchArgs.intent).toBe('course');

    // Sources should be reflected in the result.
    expect(result.sources).toEqual(DDG_SOURCES);
    expect(result.groundingFailed).toBe(false);

    // Sources should appear inside the LLM user prompt.
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Data Analyst Learning Path');
    expect(userPrompt).toContain('example.com');
  });

  it('uses the top 3 critical gap titles in the search query when gapAnalysis is provided', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce([]);
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));

    await generateLearningPath({
      ...VALID_INPUT,
      gapAnalysis: GAP_ANALYSIS,
      grounded: true,
    });

    const searchArgs = mockSearch.mock.calls[0][0];
    // Should include target + "courses" + the three critical gap titles.
    expect(searchArgs.query).toMatch(/Data analyst/);
    expect(searchArgs.query).toMatch(/courses/);
    expect(searchArgs.query).toContain('SQL fluency');
    expect(searchArgs.query).toContain('Dashboarding');
    expect(searchArgs.query).toContain('Public portfolio');
    // Non-critical gap should NOT appear.
    expect(searchArgs.query).not.toContain('Stakeholder writing');
    // Generic suffix should NOT appear when gaps are present.
    expect(searchArgs.query).not.toMatch(/learning path courses certifications/);
  });

  it('derives search query from first line of jobAdvert when no jobTitle', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce([]);
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));

    await generateLearningPath({
      jobAdvert: 'Senior UX Researcher\nWe are looking for...',
      aboutYou: 'Student',
      grounded: true,
    });

    const searchArgs = mockSearch.mock.calls[0][0];
    expect(searchArgs.query).toMatch(/Senior UX Researcher/);
  });

  it('swallows search errors and proceeds with no sources (groundingFailed=true)', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockRejectedValueOnce(new Error('network down'));
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));

    const result = await generateLearningPath({ ...VALID_INPUT, grounded: true });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.sources).toEqual([]);
    expect(result.groundingFailed).toBe(true);
    expect(result.path.target).toBe('Data Analyst');
  });
});

describe('generateLearningPath — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    await generateLearningPath(VALID_INPUT);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/learning-path designer/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Data analyst/);
  });

  it('includes resume, aboutYou, and jobAdvert in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    await generateLearningPath({
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

describe('generateLearningPath — output shape', () => {
  it('returns parsed path + sources + trimmed=false + groundingFailed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PATH_JSON));
    const result = await generateLearningPath(VALID_INPUT);
    expect(result.trimmed).toBe(false);
    expect(result.groundingFailed).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.path.target).toBe('Data Analyst');
    expect(result.path.summary).toBeTruthy();
    expect(result.path.milestones).toHaveLength(2);
    expect(result.path.milestones[0].weekRange).toBe('Weeks 1-2');
    expect(result.path.totalDuration).toBe('12 weeks part-time');
    expect(result.path.caveats.length).toBeGreaterThan(0);
  });
});

describe('generateLearningPath — token-limit retry', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_PATH_JSON));

    const result = await generateLearningPath({
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
    await expect(generateLearningPath(VALID_INPUT)).rejects.toThrow(
      /API key not configured/
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('propagates token-limit error if the trimmed retry also fails with a token-limit error', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context'));

    await expect(
      generateLearningPath({
        jobAdvert: 'A'.repeat(5000),
        aboutYou: 'Student',
      })
    ).rejects.toThrow(/maximum context/);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
