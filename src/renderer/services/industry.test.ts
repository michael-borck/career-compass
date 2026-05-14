import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateIndustryExploration } from './industry';
import type { IndustryInput } from '@/lib/prompts/industry';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_INDUSTRY_JSON = JSON.stringify({
  industry: 'Renewable energy',
  overview:
    'Renewable energy spans solar, wind, hydro, and emerging storage.\n\nIt employs engineers, project managers, policy analysts, and tradespeople.',
  keyRoles: [
    {
      title: 'Solar installer',
      description: 'Installs and maintains rooftop and utility-scale PV systems.',
      entryLevel: true,
    },
    {
      title: 'Grid integration engineer',
      description: 'Designs and tests how renewables connect to the grid.',
      entryLevel: false,
    },
  ],
  entryPoints: [
    'Apprenticeship with a solar installer',
    'Graduate program at a utility',
    'Policy internship at a state energy office',
  ],
  growthAreas: ['Battery storage', 'Green hydrogen', 'Offshore wind'],
  dayInTheLife:
    'Mornings are site visits or design reviews; afternoons skew towards reports and coordination with contractors.',
  challenges: [
    'Capital-intensive projects with long timelines',
    'Permitting and policy uncertainty',
  ],
  skillsInDemand: ['Electrical engineering', 'Project management', 'Data analysis'],
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateIndustryExploration — input handling', () => {
  it('rejects an empty industry name with a clear error', async () => {
    await expect(
      generateIndustryExploration({ industry: '' })
    ).rejects.toThrow(/industry name is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only industry name', async () => {
    await expect(
      generateIndustryExploration({ industry: '   ' })
    ).rejects.toThrow(/industry name is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts an industry name alone (resume/aboutYou optional)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_INDUSTRY_JSON));
    const result = await generateIndustryExploration({
      industry: 'Renewable energy',
    });
    expect(result.exploration.industry).toBeTruthy();
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});

describe('generateIndustryExploration — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_INDUSTRY_JSON));
    await generateIndustryExploration({ industry: 'Renewable energy' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/career exploration advisor/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Renewable energy/);
  });

  it('includes resume, aboutYou, and jobTitle in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_INDUSTRY_JSON));
    await generateIndustryExploration({
      industry: 'Healthcare tech',
      resume: 'Worked at Acme Health doing QA.',
      aboutYou: 'I love patient-facing tools.',
      jobTitle: 'Clinical informatics analyst',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Healthcare tech');
    expect(userPrompt).toContain('Acme Health');
    expect(userPrompt).toContain('patient-facing');
    expect(userPrompt).toContain('Clinical informatics analyst');
  });
});

describe('generateIndustryExploration — output shape', () => {
  it('returns parsed exploration + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_INDUSTRY_JSON));
    const result = await generateIndustryExploration({
      industry: 'Renewable energy',
    });
    expect(result.trimmed).toBe(false);
    expect(result.exploration.industry).toBe('Renewable energy');
    expect(result.exploration.overview).toBeTruthy();
    expect(result.exploration.keyRoles.length).toBeGreaterThan(0);
    expect(result.exploration.entryPoints.length).toBeGreaterThan(0);
    expect(result.exploration.growthAreas.length).toBeGreaterThan(0);
    expect(result.exploration.skillsInDemand.length).toBeGreaterThan(0);
  });

  it('preserves the entryLevel flag on roles', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_INDUSTRY_JSON));
    const result = await generateIndustryExploration({
      industry: 'Renewable energy',
    });
    const titles = result.exploration.keyRoles.map((r) => r.title);
    expect(titles).toContain('Solar installer');
    expect(titles).toContain('Grid integration engineer');
    const installer = result.exploration.keyRoles.find(
      (r) => r.title === 'Solar installer'
    );
    const engineer = result.exploration.keyRoles.find(
      (r) => r.title === 'Grid integration engineer'
    );
    expect(installer?.entryLevel).toBe(true);
    expect(engineer?.entryLevel).toBe(false);
  });

  it('throws a clear error when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(
      generateIndustryExploration({ industry: 'Renewable energy' })
    ).rejects.toThrow();
  });
});

describe('generateIndustryExploration — token-limit retry', () => {
  it('retries once with trimmed resume on token-limit error', async () => {
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_INDUSTRY_JSON));

    const input: IndustryInput = {
      industry: 'Renewable energy',
      resume: longResume,
    };
    const result = await generateIndustryExploration(input);
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after two token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('maximum context length'));
    await expect(
      generateIndustryExploration({
        industry: 'Renewable energy',
        resume: 'R'.repeat(5000),
      })
    ).rejects.toThrow(/too long for the model/i);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generateIndustryExploration({ industry: 'Renewable energy' })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
