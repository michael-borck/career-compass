import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { suggestLife, elaborateLife } from './odyssey';
import type { OdysseyElaborateInput } from '@/lib/prompts/odyssey';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_SUGGEST_JSON = JSON.stringify({
  label: 'Data storyteller for clinics',
  description:
    'I help small regional clinics make sense of their data so doctors can make better calls. It feels useful and grounded.',
});

const VALID_ELABORATE_JSON = JSON.stringify({
  headline: 'A data-grounded career serving regional health',
  dayInTheLife:
    'Mornings I review dashboards over coffee, afternoons I visit a clinic to talk through what the numbers mean.',
  typicalWeek: [
    'Two days remote on data work',
    'One day on-site at a clinic',
    'A half-day writing and learning',
    'A few hours mentoring a junior analyst',
  ],
  toolsAndSkills: ['Python', 'Tableau', 'SQL', 'Plain-English writing'],
  whoYouWorkWith:
    'Clinic managers, GPs, and a small team of analysts spread across the state.',
  challenges: [
    'Slow procurement cycles',
    'Patchy data quality',
    'Travel time eats into deep work',
  ],
  questionsToExplore: [
    'How do I price contract work for small clinics?',
    'Which adjacent skills compound fastest?',
    'Where do I want to be based?',
  ],
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

// -----------------------------------------------------------------------------
// suggestLife
// -----------------------------------------------------------------------------

describe('suggestLife — input handling', () => {
  it('rejects a missing type with a clear error', async () => {
    await expect(
      // @ts-expect-error testing runtime validation
      suggestLife({})
    ).rejects.toThrow(/valid life type is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects an invalid type with a clear error', async () => {
    await expect(
      // @ts-expect-error testing runtime validation
      suggestLife({ type: 'whatever' })
    ).rejects.toThrow(/valid life type is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it.each(['current', 'pivot', 'wildcard'] as const)(
    'accepts type=%s with no profile fields',
    async (type) => {
      mockChat.mockResolvedValueOnce(chatReply(VALID_SUGGEST_JSON));
      const result = await suggestLife({ type });
      expect(result.label).toBeTruthy();
      expect(result.description).toBeTruthy();
    }
  );
});

describe('suggestLife — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_SUGGEST_JSON));
    await suggestLife({ type: 'pivot', resume: 'Worked at Acme.' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/Odyssey Plan/);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toContain('Acme');
  });
});

describe('suggestLife — output shape', () => {
  it('returns the parsed seed on success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_SUGGEST_JSON));
    const result = await suggestLife({ type: 'current' });
    expect(result.label).toBe('Data storyteller for clinics');
    expect(result.description).toMatch(/regional clinics/);
  });

  it('throws when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(suggestLife({ type: 'current' })).rejects.toThrow();
  });
});

describe('suggestLife — no token-limit retry', () => {
  it('does not retry on token-limit errors (prompt is short)', async () => {
    mockChat.mockRejectedValueOnce(new Error('context length exceeded'));
    await expect(suggestLife({ type: 'current' })).rejects.toThrow(
      /context length/i
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// elaborateLife
// -----------------------------------------------------------------------------

const baseElaborateInput: OdysseyElaborateInput = {
  type: 'current',
  label: 'Data storyteller for clinics',
  seed: 'I help small regional clinics use their data.',
};

describe('elaborateLife — input handling', () => {
  it('rejects a missing type with a clear error', async () => {
    await expect(
      // @ts-expect-error testing runtime validation
      elaborateLife({ label: 'x', seed: 'y' })
    ).rejects.toThrow(/valid life type is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects an invalid type with a clear error', async () => {
    await expect(
      // @ts-expect-error testing runtime validation
      elaborateLife({ type: 'invalid', label: 'x', seed: 'y' })
    ).rejects.toThrow(/valid life type is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects an empty label with a clear error', async () => {
    await expect(
      elaborateLife({ type: 'current', label: '   ', seed: 'y' })
    ).rejects.toThrow(/label is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects an empty seed with a clear error', async () => {
    await expect(
      elaborateLife({ type: 'current', label: 'x', seed: '   ' })
    ).rejects.toThrow(/seed is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe('elaborateLife — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_ELABORATE_JSON));
    await elaborateLife(baseElaborateInput);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/career imagination/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toContain('Data storyteller for clinics');
    expect(args.messages[1].content).toContain('regional clinics');
  });
});

describe('elaborateLife — output shape', () => {
  it('returns parsed elaboration + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_ELABORATE_JSON));
    const result = await elaborateLife(baseElaborateInput);
    expect(result.trimmed).toBe(false);
    expect(result.elaboration.headline).toBeTruthy();
    expect(result.elaboration.dayInTheLife).toBeTruthy();
    expect(result.elaboration.typicalWeek.length).toBeGreaterThan(0);
    expect(result.elaboration.toolsAndSkills.length).toBeGreaterThan(0);
    expect(result.elaboration.challenges.length).toBeGreaterThan(0);
    expect(result.elaboration.questionsToExplore.length).toBeGreaterThan(0);
  });

  it('throws when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(elaborateLife(baseElaborateInput)).rejects.toThrow();
  });
});

describe('elaborateLife — token-limit retry chain', () => {
  it('retries with trimmed jobAdvert on first token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_ELABORATE_JSON));

    const result = await elaborateLife({
      ...baseElaborateInput,
      jobAdvert: longAdvert,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    const secondPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(secondPrompt).not.toMatch(/A{5000}/);
  });

  it('retries again with trimmed resume on second token-limit error', async () => {
    const longResume = 'R'.repeat(5000);
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('maximum context length'))
      .mockRejectedValueOnce(new Error('maximum context length'))
      .mockResolvedValueOnce(chatReply(VALID_ELABORATE_JSON));

    const result = await elaborateLife({
      ...baseElaborateInput,
      jobAdvert: longAdvert,
      resume: longResume,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);
    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
    expect(thirdPrompt).not.toMatch(/A{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('context length exceeded'));
    await expect(
      elaborateLife({
        ...baseElaborateInput,
        jobAdvert: 'A'.repeat(5000),
        resume: 'R'.repeat(5000),
      })
    ).rejects.toThrow(/too long to elaborate/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(elaborateLife(baseElaborateInput)).rejects.toThrow(
      /API key not configured/
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });
});
