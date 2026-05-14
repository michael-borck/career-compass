import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import {
  suggestCareers,
  elaborateCareer,
  generateCareers,
} from './careers';
import type { CareerBasicInfo, CareersInput } from './careers';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_LIST_JSON = JSON.stringify([
  {
    jobTitle: 'UX Designer',
    jobDescription: 'Designs interfaces.',
    timeline: '3-6 months',
    salary: '$85k - $110k',
    difficulty: 'Medium',
  },
  {
    jobTitle: 'Data Analyst',
    jobDescription: 'Analyzes data.',
    timeline: '2-4 months',
    salary: '$70k - $95k',
    difficulty: 'Low',
  },
]);

const SIX_LIST_JSON = JSON.stringify(
  Array.from({ length: 6 }, (_, i) => ({
    jobTitle: `Role ${i + 1}`,
    jobDescription: `Description ${i + 1}`,
    timeline: `${i + 1} months`,
    salary: `$${50 + i * 10}k`,
    difficulty: i % 2 === 0 ? 'Low' : 'Medium',
  }))
);

const VALID_DETAIL_JSON = JSON.stringify({
  workRequired: '10-20 hrs/week',
  aboutTheRole:
    'A UX Designer creates user-centered designs to improve product usability.',
  whyItsagoodfit: [
    'Your portfolio shows visual thinking.',
    'You enjoy talking to users.',
    'You already use Figma.',
  ],
  roadmap: [
    { '0-30 days': 'Take a UX fundamentals course.' },
    { '1-3 months': 'Build a portfolio piece.' },
    { '3-6 months': 'Apply for junior roles.' },
  ],
});

const VALID_DETAIL_FENCED = '```json\n' + VALID_DETAIL_JSON + '\n```';

const BASIC: CareerBasicInfo = {
  jobTitle: 'UX Designer',
  jobDescription: 'Designs interfaces.',
  timeline: '3-6 months',
  salary: '$85k - $110k',
  difficulty: 'Medium',
};

const INPUT: CareersInput = {
  freeText: 'I have a background in graphic design and customer support.',
};

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

// -----------------------------------------------------------------------------
// suggestCareers
// -----------------------------------------------------------------------------

describe('suggestCareers — input handling', () => {
  it('rejects an empty input with a clear error', async () => {
    await expect(suggestCareers({})).rejects.toThrow(
      /resume, job title, or some context/i
    );
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects an input where all fields are blank whitespace', async () => {
    await expect(
      suggestCareers({
        resume: '   ',
        freeText: '   ',
        jobTitle: '',
        jobAdvert: '',
      })
    ).rejects.toThrow(/resume, job title, or some context/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts any single non-empty input', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LIST_JSON));
    const result = await suggestCareers({ jobTitle: 'Data Analyst' });
    expect(result.length).toBe(2);
  });
});

describe('suggestCareers — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LIST_JSON));
    await suggestCareers({
      freeText: 'I have a Python background.',
      jobTitle: 'Data Engineer',
    });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/career expert/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toContain('Python');
    expect(args.messages[1].content).toContain('Data Engineer');
  });
});

describe('suggestCareers — output shape', () => {
  it('returns parsed CareerBasicInfo[] on success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_LIST_JSON));
    const result = await suggestCareers({ jobTitle: 'UX' });
    expect(result.length).toBe(2);
    expect(result[0].jobTitle).toBe('UX Designer');
    expect(result[0].timeline).toBe('3-6 months');
    expect(result[1].difficulty).toBe('Low');
  });

  it('tolerates code-fenced JSON from the model', async () => {
    const fenced = '```json\n' + VALID_LIST_JSON + '\n```';
    mockChat.mockResolvedValueOnce(chatReply(fenced));
    const result = await suggestCareers({ jobTitle: 'UX' });
    expect(result.length).toBe(2);
  });

  it('throws when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(suggestCareers({ jobTitle: 'UX' })).rejects.toThrow();
  });

  it('throws when the model returns a JSON object instead of an array', async () => {
    mockChat.mockResolvedValueOnce(chatReply(JSON.stringify({ careers: [] })));
    await expect(suggestCareers({ jobTitle: 'UX' })).rejects.toThrow(
      /expected an array/i
    );
  });
});

// -----------------------------------------------------------------------------
// elaborateCareer
// -----------------------------------------------------------------------------

describe('elaborateCareer — input handling', () => {
  it('rejects a missing jobTitle', async () => {
    await expect(
      elaborateCareer({ ...BASIC, jobTitle: '' }, INPUT)
    ).rejects.toThrow(/jobTitle is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only jobTitle', async () => {
    await expect(
      elaborateCareer({ ...BASIC, jobTitle: '   ' }, INPUT)
    ).rejects.toThrow(/jobTitle is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe('elaborateCareer — prompt construction', () => {
  it('sends a system + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_DETAIL_JSON));
    await elaborateCareer(BASIC, INPUT);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[1].role).toBe('user');
    // Detail prompt should reference the role and timeline.
    expect(args.messages[1].content).toContain('UX Designer');
    expect(args.messages[1].content).toContain('3-6 months');
    // And include the profile context.
    expect(args.messages[1].content).toContain('graphic design');
  });
});

describe('elaborateCareer — output shape', () => {
  it('returns basic info merged with detail block', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_DETAIL_JSON));
    const result = await elaborateCareer(BASIC, INPUT);
    // Basic fields preserved
    expect(result.jobTitle).toBe('UX Designer');
    expect(result.timeline).toBe('3-6 months');
    expect(result.salary).toBe('$85k - $110k');
    // Detail fields populated
    expect(result.workRequired).toBe('10-20 hrs/week');
    expect(result.aboutTheRole).toMatch(/user-centered/);
    expect(result.whyItsagoodfit.length).toBe(3);
    expect(result.roadmap.length).toBe(3);
  });

  it('tolerates code-fenced JSON from the model', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_DETAIL_FENCED));
    const result = await elaborateCareer(BASIC, INPUT);
    expect(result.workRequired).toBe('10-20 hrs/week');
  });

  it('throws when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('definitely not json'));
    await expect(elaborateCareer(BASIC, INPUT)).rejects.toThrow();
  });

  it('rethrows network/chat errors', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(elaborateCareer(BASIC, INPUT)).rejects.toThrow(
      /API key not configured/
    );
  });
});

// -----------------------------------------------------------------------------
// generateCareers (orchestration)
// -----------------------------------------------------------------------------

describe('generateCareers — orchestration', () => {
  it('runs stage 1 then six stage-2 calls in parallel for six careers', async () => {
    mockChat
      .mockResolvedValueOnce(chatReply(SIX_LIST_JSON)) // stage 1
      .mockResolvedValue(chatReply(VALID_DETAIL_JSON)); // stage 2 x6

    const result = await generateCareers({ jobTitle: 'Anything' });
    // 1 list call + 6 detail calls = 7
    expect(mockChat).toHaveBeenCalledTimes(7);
    expect(result.length).toBe(6);
    // Every result should carry both basic + detail fields.
    for (const r of result) {
      expect(r.jobTitle).toBeTruthy();
      expect(r.workRequired).toBe('10-20 hrs/week');
      expect(r.whyItsagoodfit.length).toBeGreaterThan(0);
    }
  });

  it('falls back to basic info when a per-career detail call fails', async () => {
    mockChat
      .mockResolvedValueOnce(chatReply(VALID_LIST_JSON)) // stage 1 (2 careers)
      .mockResolvedValueOnce(chatReply(VALID_DETAIL_JSON)) // detail 1 OK
      .mockRejectedValueOnce(new Error('rate limit')); // detail 2 fails

    const result = await generateCareers({ jobTitle: 'UX' });
    expect(result.length).toBe(2);
    // First career: full detail.
    expect(result[0].jobTitle).toBe('UX Designer');
    expect(result[0].workRequired).toBe('10-20 hrs/week');
    expect(result[0].whyItsagoodfit.length).toBe(3);
    // Second career: basic only, empty detail fields.
    expect(result[1].jobTitle).toBe('Data Analyst');
    expect(result[1].workRequired).toBe('');
    expect(result[1].whyItsagoodfit).toEqual([]);
    expect(result[1].roadmap).toEqual([]);
  });

  it('throws if stage 1 fails (the page should not get partial results)', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(generateCareers({ jobTitle: 'UX' })).rejects.toThrow(
      /API key not configured/
    );
    // Only the stage-1 call was attempted.
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('throws upfront if input is empty (no LLM calls made)', async () => {
    await expect(generateCareers({})).rejects.toThrow(
      /resume, job title, or some context/i
    );
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('survives all six detail failures and returns all six basics', async () => {
    mockChat
      .mockResolvedValueOnce(chatReply(SIX_LIST_JSON)) // stage 1
      .mockRejectedValue(new Error('rate limit')); // every detail fails

    const result = await generateCareers({ jobTitle: 'Anything' });
    expect(result.length).toBe(6);
    for (const r of result) {
      expect(r.workRequired).toBe('');
      expect(r.whyItsagoodfit).toEqual([]);
      expect(r.roadmap).toEqual([]);
    }
  });
});
