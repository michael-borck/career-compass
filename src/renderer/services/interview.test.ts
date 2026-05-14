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
import {
  runInterviewTurn,
  generateInterviewFeedback,
} from './interview';
import type {
  ChatMessage,
  InterviewDifficulty,
  InterviewPhase,
  SourceRef,
} from '@/lib/session-store';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;
const mockSearch = search as unknown as ReturnType<typeof vi.fn>;
const mockLoadSearchSettings =
  loadSearchSettings as unknown as ReturnType<typeof vi.fn>;
const mockIsSearchConfigured =
  isSearchConfigured as unknown as ReturnType<typeof vi.fn>;

function chatReply(content: string) {
  return { content, usage: undefined };
}

function makeMessage(
  role: 'user' | 'assistant',
  content: string,
  id?: string
): ChatMessage {
  return {
    id: id ?? `${role}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: Date.now(),
    kind: 'message',
  };
}

const DDG_SOURCES: SourceRef[] = [
  {
    title: 'Data Analyst Interview Questions',
    url: 'https://example.com/interview',
    domain: 'example.com',
  },
];

const TURN_BASE = {
  target: 'Data Analyst',
  difficulty: 'standard' as InterviewDifficulty,
  phase: 'warm-up' as InterviewPhase,
  turnInPhase: 0,
};

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

// =====================================================================
// runInterviewTurn
// =====================================================================

describe('runInterviewTurn — validation', () => {
  it('throws when no target is provided', async () => {
    await expect(
      runInterviewTurn({ ...TURN_BASE, target: '', messages: [] })
    ).rejects.toThrow(/target is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('treats whitespace-only target as missing', async () => {
    await expect(
      runInterviewTurn({ ...TURN_BASE, target: '   ', messages: [] })
    ).rejects.toThrow(/target is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe('runInterviewTurn — opening turn / message shape', () => {
  it('seeds a synthetic user kickoff when messages is empty', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Tell me about yourself.'));

    await runInterviewTurn({ ...TURN_BASE, messages: [] });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const sent = mockChat.mock.calls[0][0].messages;
    // First message must be system prompt.
    expect(sent[0].role).toBe('system');
    expect(sent[0].content).toMatch(/Data Analyst/);
    // Last message must be the synthetic kickoff (no context block, no
    // history, so it's at index 1).
    const lastUser = sent.findLast
      ? sent.findLast((m: any) => m.role === 'user')
      : [...sent].reverse().find((m: any) => m.role === 'user');
    expect(lastUser.role).toBe('user');
    expect(lastUser.content).toMatch(/ready to begin/i);
    expect(lastUser.content).toMatch(/Data Analyst/);
  });

  it('passes existing history through (no synthetic kickoff)', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Great. Walk me through a project.'));

    const history: ChatMessage[] = [
      makeMessage('assistant', 'Tell me about yourself.'),
      makeMessage('user', "I'm a CS student."),
    ];
    await runInterviewTurn({ ...TURN_BASE, messages: history });

    const sent = mockChat.mock.calls[0][0].messages;
    // No "ready to begin" seed should appear.
    const hasSeed = sent.some((m: any) => /ready to begin/i.test(m.content));
    expect(hasSeed).toBe(false);
    // History content is forwarded.
    const userTexts = sent.filter((m: any) => m.role === 'user').map((m: any) => m.content);
    expect(userTexts.some((c: string) => c.includes("CS student"))).toBe(true);
  });

  it('appends a context-block system message when profile inputs are present', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Question.'));

    await runInterviewTurn({
      ...TURN_BASE,
      messages: [],
      resumeText: 'Worked at Acme Corp doing QA.',
      freeText: 'I love testing.',
      jobAdvert: 'We are hiring a junior QA engineer.',
      jobTitle: 'QA engineer',
    });

    const sent = mockChat.mock.calls[0][0].messages;
    const systemMessages = sent.filter((m: any) => m.role === 'system');
    expect(systemMessages.length).toBe(2);
    const contextBlock = systemMessages[1].content;
    expect(contextBlock).toContain('Acme Corp');
    expect(contextBlock).toContain('love testing');
    expect(contextBlock).toContain('hiring a junior QA');
  });

  it('skips the context-block message when no profile inputs are present', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Question.'));

    await runInterviewTurn({ ...TURN_BASE, messages: [] });

    const sent = mockChat.mock.calls[0][0].messages;
    const systemMessages = sent.filter((m: any) => m.role === 'system');
    expect(systemMessages.length).toBe(1);
  });

  it('filters non-message kinds from the history', async () => {
    mockChat.mockResolvedValueOnce(chatReply('next'));

    const history: ChatMessage[] = [
      makeMessage('assistant', 'Q1'),
      { ...makeMessage('user', '<<file uploaded>>'), kind: 'attachment-summary' as const },
      { ...makeMessage('user', '--- focus shift ---'), kind: 'focus-marker' as const },
      makeMessage('user', 'A1'),
    ];
    await runInterviewTurn({ ...TURN_BASE, messages: history });

    const sent = mockChat.mock.calls[0][0].messages;
    const contents = sent.map((m: any) => m.content).join('|');
    expect(contents).not.toMatch(/file uploaded/);
    expect(contents).not.toMatch(/focus shift/);
    expect(contents).toContain('Q1');
    expect(contents).toContain('A1');
  });
});

describe('runInterviewTurn — search integration', () => {
  it('does not call search outside the role-specific phase', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Question.'));
    await runInterviewTurn({ ...TURN_BASE, phase: 'warm-up', messages: [] });
    expect(mockLoadSearchSettings).not.toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not call search during behavioural phase', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Question.'));
    await runInterviewTurn({ ...TURN_BASE, phase: 'behavioural', messages: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('does not call search when role-specific phase but search not configured', async () => {
    mockIsSearchConfigured.mockReturnValue(false);
    mockChat.mockResolvedValueOnce(chatReply('Question.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'role-specific',
      messages: [],
    });

    expect(mockLoadSearchSettings).toHaveBeenCalledTimes(1);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.groundingFailed).toBe(false);
  });

  it('calls search during role-specific phase when configured, passes results into system prompt', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockResolvedValueOnce(DDG_SOURCES);
    mockChat.mockResolvedValueOnce(chatReply('Question.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'role-specific',
      messages: [],
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    const searchArgs = mockSearch.mock.calls[0][0];
    expect(searchArgs.query).toMatch(/Data Analyst/);
    expect(searchArgs.query).toMatch(/interview questions/i);
    expect(searchArgs.intent).toBe('general');

    expect(result.sources).toEqual(DDG_SOURCES);
    expect(result.groundingFailed).toBe(false);

    // Sources should appear inside the system prompt.
    const systemContent = mockChat.mock.calls[0][0].messages[0].content;
    expect(systemContent).toContain('Data Analyst Interview Questions');
    expect(systemContent).toContain('example.com');
  });

  it('swallows search errors and proceeds with no sources (groundingFailed=true)', async () => {
    mockIsSearchConfigured.mockReturnValue(true);
    mockSearch.mockRejectedValueOnce(new Error('network down'));
    mockChat.mockResolvedValueOnce(chatReply('Question.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'role-specific',
      messages: [],
    });

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(result.sources).toEqual([]);
    expect(result.groundingFailed).toBe(true);
  });
});

describe('runInterviewTurn — output shape & phase progression', () => {
  it('advances within a phase when turns remain', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Next behavioural Q.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'behavioural',
      turnInPhase: 0,
      messages: [makeMessage('assistant', 'prior q'), makeMessage('user', 'prior a')],
    });

    expect(result.reply).toBe('Next behavioural Q.');
    expect(result.nextPhase).toBe('behavioural');
    expect(result.nextTurnInPhase).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.trimmed).toBe(false);
  });

  it('jumps to the next phase when the current phase finishes', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Now a behavioural question.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'warm-up',
      turnInPhase: 0,
      messages: [makeMessage('assistant', 'tell me about yourself')],
    });

    // warm-up has 1 turn → next is behavioural at turnInPhase=0
    expect(result.nextPhase).toBe('behavioural');
    expect(result.nextTurnInPhase).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  it('signals isComplete=true after wrap-up', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Thanks, that wraps us up.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'wrap-up',
      turnInPhase: 0,
      messages: [makeMessage('assistant', 'any questions?'), makeMessage('user', 'nope')],
    });

    expect(result.nextPhase).toBe(null);
    expect(result.isComplete).toBe(true);
    expect(result.trimmed).toBe(false);
  });
});

describe('runInterviewTurn — token-limit retry chain', () => {
  it('retries with trimmed advert on token-limit error', async () => {
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply('Question.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      messages: [],
      jobAdvert: longAdvert,
    });

    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);
    // The retry's context-block (a system message) should contain the trimmed advert.
    const secondSystemMsgs = mockChat.mock.calls[1][0].messages.filter(
      (m: any) => m.role === 'system'
    );
    const secondContext = secondSystemMsgs[1]?.content ?? '';
    expect(secondContext).toMatch(/A{4000}/);
    expect(secondContext).not.toMatch(/A{5000}/);
  });

  it('retries with trimmed history when advert-trim retry also hits token limit', async () => {
    // Build 25 history messages so the trim to last 20 is observable.
    const history: ChatMessage[] = [];
    for (let i = 0; i < 25; i++) {
      history.push(makeMessage(i % 2 === 0 ? 'assistant' : 'user', `msg-${i}`, `m-${i}`));
    }
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context'))
      .mockResolvedValueOnce(chatReply('Question.'));

    const result = await runInterviewTurn({
      ...TURN_BASE,
      phase: 'behavioural',
      turnInPhase: 0,
      messages: history,
    });

    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);

    // Third call should contain only the last 20 history messages (+ system).
    const third = mockChat.mock.calls[2][0].messages;
    const userAndAssistant = third.filter((m: any) => m.role !== 'system');
    expect(userAndAssistant.length).toBe(20);
    // Earliest msg in the trim should be m-5.
    expect(userAndAssistant[0].content).toBe('msg-5');
    // Latest should be m-24.
    expect(userAndAssistant[userAndAssistant.length - 1].content).toBe('msg-24');
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      runInterviewTurn({ ...TURN_BASE, messages: [] })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('propagates the token-limit error if all retries also fail with token-limit', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('reduce the length'));
    await expect(
      runInterviewTurn({ ...TURN_BASE, messages: [] })
    ).rejects.toThrow(/reduce the length/);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });
});

// =====================================================================
// generateInterviewFeedback
// =====================================================================

const VALID_FEEDBACK_JSON = JSON.stringify({
  target: 'Data Analyst',
  difficulty: 'standard',
  summary: 'Solid interview overall with clear room to improve specificity.',
  strengths: ['Communicated calmly', 'Used STAR-ish structure', 'Showed curiosity'],
  improvements: [
    {
      area: 'Be more specific',
      why: 'Specific examples are more memorable than generalities.',
      example:
        'You said: "I worked on a team project." Reframe: "I led the data cleaning step on a 4-person capstone, which cut model error by 12%."',
    },
  ],
  perPhase: [
    { phase: 'warm-up', note: 'Smooth, friendly opener.' },
    { phase: 'behavioural', note: 'Answers were a bit vague.' },
  ],
  overallRating: 'on-track',
  nextSteps: ['Rehearse 3 STAR stories aloud', 'Prepare a specific question to ask back'],
});

const TRANSCRIPT: ChatMessage[] = [
  makeMessage('assistant', 'Tell me about yourself.'),
  makeMessage('user', "I'm a CS student interested in data."),
  makeMessage('assistant', 'Walk me through a project.'),
  makeMessage('user', 'I worked on a team project for analytics.'),
];

describe('generateInterviewFeedback — validation', () => {
  it('throws when no target is provided', async () => {
    await expect(
      generateInterviewFeedback({
        messages: TRANSCRIPT,
        target: '',
        difficulty: 'standard',
        reachedPhase: 'wrap-up',
      })
    ).rejects.toThrow(/target is required/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('throws when transcript has no user messages', async () => {
    await expect(
      generateInterviewFeedback({
        messages: [makeMessage('assistant', 'opener')],
        target: 'Data Analyst',
        difficulty: 'standard',
        reachedPhase: 'warm-up',
      })
    ).rejects.toThrow(/no interview transcript/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('ignores non-message kinds when counting user messages', async () => {
    // Only an attachment-summary "user" message → still treated as empty transcript.
    const messages: ChatMessage[] = [
      makeMessage('assistant', 'opener'),
      { ...makeMessage('user', 'file:resume.pdf'), kind: 'attachment-summary' as const },
    ];
    await expect(
      generateInterviewFeedback({
        messages,
        target: 'Data Analyst',
        difficulty: 'standard',
        reachedPhase: 'warm-up',
      })
    ).rejects.toThrow(/no interview transcript/i);
  });
});

describe('generateInterviewFeedback — prompt construction', () => {
  it('sends a JSON system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_FEEDBACK_JSON));
    await generateInterviewFeedback({
      messages: TRANSCRIPT,
      target: 'Data Analyst',
      difficulty: 'standard',
      reachedPhase: 'wrap-up',
    });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/interview coach/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/Data Analyst/);
  });

  it('includes the actual transcript content in the user prompt', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_FEEDBACK_JSON));
    await generateInterviewFeedback({
      messages: TRANSCRIPT,
      target: 'Data Analyst',
      difficulty: 'standard',
      reachedPhase: 'wrap-up',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('CS student');
    expect(userPrompt).toContain('analytics');
  });

  it('flags partial interviews when reachedPhase !== wrap-up', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_FEEDBACK_JSON));
    await generateInterviewFeedback({
      messages: TRANSCRIPT,
      target: 'Data Analyst',
      difficulty: 'standard',
      reachedPhase: 'behavioural',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toMatch(/ended early/i);
  });
});

describe('generateInterviewFeedback — output shape', () => {
  it('returns parsed feedback + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_FEEDBACK_JSON));
    const result = await generateInterviewFeedback({
      messages: TRANSCRIPT,
      target: 'Data Analyst',
      difficulty: 'standard',
      reachedPhase: 'wrap-up',
    });
    expect(result.trimmed).toBe(false);
    expect(result.feedback.target).toBe('Data Analyst');
    expect(result.feedback.difficulty).toBe('standard');
    expect(result.feedback.overallRating).toBe('on-track');
    expect(result.feedback.strengths).toHaveLength(3);
    expect(result.feedback.improvements).toHaveLength(1);
    expect(result.feedback.perPhase).toHaveLength(2);
    expect(result.feedback.nextSteps).toHaveLength(2);
  });
});

describe('generateInterviewFeedback — token-limit retry', () => {
  it('retries with trimmed transcript and a heads-up prefix on token-limit error', async () => {
    // Build 40 messages so the trim to last 30 is observable.
    const long: ChatMessage[] = [];
    for (let i = 0; i < 40; i++) {
      long.push(makeMessage(i % 2 === 0 ? 'assistant' : 'user', `msg-${i}`, `m-${i}`));
    }
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_FEEDBACK_JSON));

    const result = await generateInterviewFeedback({
      messages: long,
      target: 'Data Analyst',
      difficulty: 'standard',
      reachedPhase: 'wrap-up',
    });

    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);

    const retryUserPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(retryUserPrompt).toMatch(/Earlier messages were dropped/i);
    // Earliest kept message should be msg-10.
    expect(retryUserPrompt).toContain('msg-10');
    expect(retryUserPrompt).toContain('msg-39');
    // msg-9 and earlier must have been dropped.
    expect(retryUserPrompt).not.toContain('msg-9\n');
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generateInterviewFeedback({
        messages: TRANSCRIPT,
        target: 'Data Analyst',
        difficulty: 'standard',
        reachedPhase: 'wrap-up',
      })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('propagates token-limit error if the trimmed retry also fails with a token-limit error', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context'));
    await expect(
      generateInterviewFeedback({
        messages: TRANSCRIPT,
        target: 'Data Analyst',
        difficulty: 'standard',
        reachedPhase: 'wrap-up',
      })
    ).rejects.toThrow(/maximum context/);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
