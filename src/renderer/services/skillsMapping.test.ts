import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateSkillsMapping } from './skillsMapping';
import type { SkillsMappingInput } from '@/lib/prompts/skills-mapping';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_MAPPING_JSON = JSON.stringify({
  summary:
    'Your background blends customer support, data analysis, and project coordination. SFIA and O*NET cover most of these well; AQF reflects your qualification level.',
  frameworkNotes:
    'SFIA (AU/UK digital) is the strongest fit for the data/coordination skills. O*NET (US broad) covers customer-facing work. ESCO (EU) maps cleanly to the analyst skills. AQF (AU qualifications) suggests level 7.',
  mappings: [
    {
      skill: 'SQL data analysis',
      sfia: {
        name: 'Data analysis',
        level: '3',
        description: 'Investigates corporate data requirements.',
      },
      onet: {
        name: 'Critical thinking',
        level: '4',
        description: 'Using logic and reasoning to identify alternatives.',
      },
      esco: {
        name: 'Analyse business processes',
        level: '4',
        description: 'Study how processes contribute to business goals.',
      },
      aqf: null,
      professionalPhrase: 'Built and maintained SQL reports across 12 customer cohorts.',
      nextLevel: 'Lead a cross-team data project and document the framework used.',
    },
    {
      skill: 'Stakeholder communication',
      sfia: null,
      onet: {
        name: 'Active listening',
        level: '4',
        description: 'Giving full attention to what others are saying.',
      },
      esco: null,
      aqf: {
        name: 'Bachelor degree',
        level: '7',
        description: 'Coherent body of knowledge in a discipline.',
      },
      professionalPhrase: 'Facilitated weekly steering meetings across three departments.',
      nextLevel: 'Run a workshop with mixed-seniority stakeholders end-to-end.',
    },
  ],
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateSkillsMapping — input handling', () => {
  it('rejects when no profile signal is supplied', async () => {
    await expect(
      generateSkillsMapping({})
    ).rejects.toThrow(/profile is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects when only whitespace-only resume/aboutYou are supplied', async () => {
    await expect(
      generateSkillsMapping({ resume: '   ', aboutYou: '  ' })
    ).rejects.toThrow(/profile is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts a resume alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    const result = await generateSkillsMapping({
      resume: 'Worked at Acme as a customer success analyst.',
    });
    expect(result.mapping.mappings.length).toBeGreaterThan(0);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('accepts an aboutYou string alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    const result = await generateSkillsMapping({
      aboutYou: 'Five years in retail, transitioning to analytics.',
    });
    expect(result.mapping.summary).toBeTruthy();
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('accepts a distilledProfile alone (no resume/aboutYou)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    const result = await generateSkillsMapping({
      distilledProfile: {
        background: 'Career-changer from retail to analytics',
        interests: ['data', 'people'],
        skills: ['SQL', 'communication'],
        constraints: ['Perth-based'],
        goals: ['land a junior analyst role within 12 months'],
      },
    });
    expect(result.mapping.mappings.length).toBeGreaterThan(0);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});

describe('generateSkillsMapping — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    await generateSkillsMapping({ resume: 'Acme analyst since 2021.' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/career skills analyst/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Acme analyst/);
  });

  it('includes resume, aboutYou, and jobTitle in the user prompt when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    await generateSkillsMapping({
      resume: 'Worked at Acme Health doing QA.',
      aboutYou: 'I love patient-facing tools.',
      jobTitle: 'Clinical informatics analyst',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Acme Health');
    expect(userPrompt).toContain('patient-facing');
    expect(userPrompt).toContain('Clinical informatics analyst');
  });
});

describe('generateSkillsMapping — output shape', () => {
  it('returns parsed mapping + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    const result = await generateSkillsMapping({
      resume: 'Analyst at Acme.',
    });
    expect(result.trimmed).toBe(false);
    expect(result.mapping.summary).toBeTruthy();
    expect(result.mapping.frameworkNotes).toBeTruthy();
    expect(result.mapping.mappings.length).toBe(2);
  });

  it('preserves framework levels and null entries on mappings', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));
    const result = await generateSkillsMapping({
      resume: 'Analyst at Acme.',
    });
    const sql = result.mapping.mappings.find((m) => m.skill === 'SQL data analysis');
    const comms = result.mapping.mappings.find(
      (m) => m.skill === 'Stakeholder communication'
    );
    expect(sql?.sfia?.name).toBe('Data analysis');
    expect(sql?.sfia?.level).toBe('3');
    expect(sql?.aqf).toBeNull();
    expect(comms?.sfia).toBeNull();
    expect(comms?.aqf?.level).toBe('7');
    expect(sql?.professionalPhrase).toMatch(/SQL reports/);
    expect(comms?.nextLevel).toMatch(/workshop/i);
  });

  it('throws a clear error when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(
      generateSkillsMapping({ resume: 'Analyst at Acme.' })
    ).rejects.toThrow();
  });
});

describe('generateSkillsMapping — token-limit retry', () => {
  it('retries once with trimmed resume on token-limit error', async () => {
    const longResume = 'R'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_MAPPING_JSON));

    const input: SkillsMappingInput = {
      resume: longResume,
    };
    const result = await generateSkillsMapping(input);
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).not.toMatch(/R{5000}/);
  });

  it('surrenders with a helpful error after two token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('maximum context length'));
    await expect(
      generateSkillsMapping({
        resume: 'R'.repeat(5000),
      })
    ).rejects.toThrow(/too long for the model/i);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generateSkillsMapping({ resume: 'Analyst at Acme.' })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
