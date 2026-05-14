import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client and the search module before importing the service.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

vi.mock('./search', () => ({
  search: vi.fn(),
}));

import { chat } from './llm';
import { search } from './search';
import { runChatTurn, runChatSearch, distillProfile } from './chat';
import type { ChatMessage, SourceRef } from '@/lib/session-store';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;
const mockSearch = search as unknown as ReturnType<typeof vi.fn>;

function chatReply(content: string) {
  return { content, usage: undefined };
}

function makeMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  id?: string,
  kind: 'message' | 'attachment-summary' | 'focus-marker' | 'notice' = 'message'
): ChatMessage {
  return {
    id: id ?? `${role}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: Date.now(),
    kind,
  };
}

const SOURCES: SourceRef[] = [
  {
    title: 'What does a data analyst do?',
    url: 'https://example.com/da',
    domain: 'example.com',
  },
];

const TURN_BASE = {
  currentFocus: null as string | null,
};

beforeEach(() => {
  mockChat.mockReset();
  mockSearch.mockReset();
});

// =====================================================================
// runChatTurn
// =====================================================================

describe('runChatTurn — message shape', () => {
  it('always sends the advisor system prompt as the first message', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Hi there.'));
    await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'Hello')],
    });
    const sent = mockChat.mock.calls[0][0].messages;
    expect(sent[0].role).toBe('system');
    expect(sent[0].content).toMatch(/career advisor/i);
  });

  it('embeds the current focus into the advisor system prompt when set', async () => {
    mockChat.mockResolvedValueOnce(chatReply('ok'));
    await runChatTurn({
      ...TURN_BASE,
      currentFocus: 'Data Analyst',
      messages: [makeMessage('user', 'tell me more')],
    });
    const sent = mockChat.mock.calls[0][0].messages;
    expect(sent[0].content).toMatch(/Current focus: Data Analyst/);
  });

  it('appends a context-block system message when inputs are present', async () => {
    mockChat.mockResolvedValueOnce(chatReply('ok'));
    await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'help')],
      resumeText: 'Worked at Acme Corp doing QA.',
      freeText: 'I love testing.',
      jobTitle: 'QA engineer',
      jobAdvert: 'We are hiring a junior QA engineer.',
    });
    const sent = mockChat.mock.calls[0][0].messages;
    const systemMessages = sent.filter((m: any) => m.role === 'system');
    // advisor prompt + context block
    expect(systemMessages.length).toBe(2);
    expect(systemMessages[1].content).toContain('Acme Corp');
    expect(systemMessages[1].content).toContain('love testing');
    expect(systemMessages[1].content).toContain('QA engineer');
    expect(systemMessages[1].content).toContain('hiring a junior QA');
  });

  it('skips the context-block message when no profile inputs are present', async () => {
    mockChat.mockResolvedValueOnce(chatReply('ok'));
    await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'help')],
    });
    const sent = mockChat.mock.calls[0][0].messages;
    const systemMessages = sent.filter((m: any) => m.role === 'system');
    expect(systemMessages.length).toBe(1);
  });

  it('adds a third system message with formatted sources when searchSources are provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply('ok'));
    await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'salary for data analyst?')],
      searchSources: SOURCES,
    });
    const sent = mockChat.mock.calls[0][0].messages;
    const systemMessages = sent.filter((m: any) => m.role === 'system');
    // advisor prompt + sources footnote (no context block)
    expect(systemMessages.length).toBe(2);
    expect(systemMessages[1].content).toContain('<sources>');
    expect(systemMessages[1].content).toContain('What does a data analyst do?');
    expect(systemMessages[1].content).toContain('example.com');
  });

  it('omits the sources system message when searchSources is empty array', async () => {
    mockChat.mockResolvedValueOnce(chatReply('ok'));
    await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'hi')],
      searchSources: [],
    });
    const sent = mockChat.mock.calls[0][0].messages;
    const systemMessages = sent.filter((m: any) => m.role === 'system');
    expect(systemMessages.length).toBe(1);
  });

  it('forwards user/assistant history while filtering non-message kinds', async () => {
    mockChat.mockResolvedValueOnce(chatReply('next reply'));
    const history: ChatMessage[] = [
      makeMessage('user', 'first ask'),
      makeMessage('assistant', 'first reply'),
      makeMessage('system', '📎 file attached', undefined, 'attachment-summary'),
      makeMessage('system', '— focus cleared —', undefined, 'focus-marker'),
      makeMessage('system', 'Earlier messages were trimmed.', undefined, 'notice'),
      makeMessage('user', 'second ask'),
    ];
    await runChatTurn({ ...TURN_BASE, messages: history });
    const sent = mockChat.mock.calls[0][0].messages;
    const contents = sent.map((m: any) => m.content).join('|');
    expect(contents).not.toMatch(/file attached/);
    expect(contents).not.toMatch(/focus cleared/);
    expect(contents).not.toMatch(/Earlier messages were trimmed/);
    expect(contents).toContain('first ask');
    expect(contents).toContain('first reply');
    expect(contents).toContain('second ask');
  });

  it('does not call search itself — gating is the caller\'s responsibility', async () => {
    mockChat.mockResolvedValueOnce(chatReply('ok'));
    await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'what is a data analyst?')],
    });
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

describe('runChatTurn — output shape', () => {
  it('returns the LLM reply and trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply('Here is what I would say.'));
    const result = await runChatTurn({
      ...TURN_BASE,
      messages: [makeMessage('user', 'hi')],
    });
    expect(result.reply).toBe('Here is what I would say.');
    expect(result.trimmed).toBe(false);
  });
});

describe('runChatTurn — token-limit retry chain', () => {
  it('retries with trimmed history on token-limit error and reports trimmed=true', async () => {
    // 25 messages → trim to 20 should be observable.
    const history: ChatMessage[] = [];
    for (let i = 0; i < 25; i++) {
      history.push(
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg-${i}`, `m-${i}`)
      );
    }
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply('ok'));

    const result = await runChatTurn({ ...TURN_BASE, messages: history });

    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);

    // Second call should contain only the last 20 history messages (+ system).
    const second = mockChat.mock.calls[1][0].messages;
    const userAndAssistant = second.filter((m: any) => m.role !== 'system');
    expect(userAndAssistant.length).toBe(20);
    expect(userAndAssistant[0].content).toBe('msg-5');
    expect(userAndAssistant[userAndAssistant.length - 1].content).toBe('msg-24');
  });

  it('preserves older attachment-summary anchors when trimming history', async () => {
    // 25 messages, with an attachment-summary at index 1.
    const history: ChatMessage[] = [
      makeMessage('user', 'opening ask', 'op'),
      makeMessage(
        'system',
        '📎 Attached resume: cv.pdf (1234 chars)',
        'att',
        'attachment-summary'
      ),
    ];
    for (let i = 0; i < 23; i++) {
      history.push(
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg-${i}`, `m-${i}`)
      );
    }
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply('ok'));

    await runChatTurn({ ...TURN_BASE, messages: history });

    // The retry's trim should preserve the older attachment-summary in the
    // ChatMessage list — but toProviderMessages then filters non-'message'
    // kinds out, so the LLM never sees the attachment-summary. Verify it's
    // filtered correctly: the retry's user/assistant message count is
    // still bounded by 20.
    const second = mockChat.mock.calls[1][0].messages;
    const userAndAssistant = second.filter((m: any) => m.role !== 'system');
    expect(userAndAssistant.length).toBeLessThanOrEqual(20);
    // The opening ask (at index 0, far older than the trim window) was an
    // ordinary 'message' kind, so it is NOT preserved — only attachments are.
    const contents = userAndAssistant.map((m: any) => m.content).join('|');
    expect(contents).not.toContain('opening ask');
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      runChatTurn({
        ...TURN_BASE,
        messages: [makeMessage('user', 'hi')],
      })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('propagates the token-limit error if the trimmed retry also fails with token-limit', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('reduce the length'));
    await expect(
      runChatTurn({
        ...TURN_BASE,
        messages: [makeMessage('user', 'hi')],
      })
    ).rejects.toThrow(/reduce the length/);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});

// =====================================================================
// runChatSearch
// =====================================================================

describe('runChatSearch', () => {
  it('delegates to search() with general intent and trimmed query', async () => {
    mockSearch.mockResolvedValueOnce(SOURCES);
    const result = await runChatSearch('  data analyst job  ');
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith({
      query: 'data analyst job',
      intent: 'general',
    });
    expect(result).toEqual(SOURCES);
  });

  it('throws when the query is empty', async () => {
    await expect(runChatSearch('')).rejects.toThrow(/required/i);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('throws when the query is whitespace-only', async () => {
    await expect(runChatSearch('   \n\t  ')).rejects.toThrow(/required/i);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('propagates errors from the search service', async () => {
    mockSearch.mockRejectedValueOnce(new Error('Brave: 401 Unauthorized'));
    await expect(runChatSearch('data analyst')).rejects.toThrow(/Brave: 401/);
  });

  it('returns an empty array when search is disabled (search returns [])', async () => {
    mockSearch.mockResolvedValueOnce([]);
    const result = await runChatSearch('data analyst');
    expect(result).toEqual([]);
  });
});

// =====================================================================
// distillProfile
// =====================================================================

const VALID_PROFILE_JSON = JSON.stringify({
  background:
    'A second-year CS student exploring data and ML roles, with some Python experience.',
  interests: ['data analysis', 'machine learning'],
  skills: ['Python', 'SQL basics'],
  constraints: ['student visa', 'limited time during semester'],
  goals: ['land a data analyst internship', 'build a portfolio project'],
});

const TRANSCRIPT: ChatMessage[] = [
  makeMessage('assistant', 'Welcome! What are you exploring?'),
  makeMessage('user', "I'm a CS student interested in data and ML."),
  makeMessage('assistant', 'Great. What have you built so far?'),
  makeMessage('user', "Some Python scripts, a basic SQL course."),
];

describe('distillProfile — prompt construction', () => {
  it('sends a JSON system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PROFILE_JSON));
    await distillProfile({ messages: TRANSCRIPT });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/structured JSON profiles/i);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toMatch(/distill/i);
  });

  it('includes the transcript content in the user prompt', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PROFILE_JSON));
    await distillProfile({ messages: TRANSCRIPT });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('CS student');
    expect(userPrompt).toContain('SQL course');
  });

  it('includes resume / freeText / jobTitle / guidance when provided', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PROFILE_JSON));
    await distillProfile({
      messages: TRANSCRIPT,
      resume: 'Resume text here',
      freeText: 'About me text',
      jobTitle: 'Data Analyst',
      guidance: 'focus on the data thread',
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Resume text here');
    expect(userPrompt).toContain('About me text');
    expect(userPrompt).toContain('Data Analyst');
    expect(userPrompt).toContain('focus on the data thread');
  });
});

describe('distillProfile — output shape', () => {
  it('returns the parsed profile and trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_PROFILE_JSON));
    const result = await distillProfile({ messages: TRANSCRIPT });
    expect(result.trimmed).toBe(false);
    expect(result.profile.background).toMatch(/CS student/);
    expect(result.profile.interests).toContain('data analysis');
    expect(result.profile.skills).toContain('Python');
    expect(result.profile.constraints.length).toBeGreaterThan(0);
    expect(result.profile.goals.length).toBeGreaterThan(0);
  });

  it('throws when the LLM returns a missing-background JSON', async () => {
    const bad = JSON.stringify({
      interests: ['something'],
      skills: [],
      constraints: [],
      goals: [],
    });
    mockChat.mockResolvedValueOnce(chatReply(bad));
    await expect(distillProfile({ messages: TRANSCRIPT })).rejects.toThrow(
      /missing background/i
    );
  });

  it('throws when the LLM returns non-JSON text', async () => {
    mockChat.mockResolvedValueOnce(chatReply('I am sorry, I cannot help.'));
    await expect(distillProfile({ messages: TRANSCRIPT })).rejects.toThrow();
  });
});

describe('distillProfile — token-limit retry', () => {
  it('retries with trimmed transcript and a trimmed=true flag on token-limit error', async () => {
    const long: ChatMessage[] = [];
    for (let i = 0; i < 40; i++) {
      long.push(
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg-${i}`, `m-${i}`)
      );
    }
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_PROFILE_JSON));

    const result = await distillProfile({ messages: long });

    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);

    const retryUserPrompt = mockChat.mock.calls[1][0].messages[1].content;
    // The trimmed=true flag triggers a heads-up note in the prompt.
    expect(retryUserPrompt).toMatch(/recent portion of a longer conversation/i);
    // Earliest kept msg is m-10 (last 30 of 40), latest is m-39.
    expect(retryUserPrompt).toContain('msg-10');
    expect(retryUserPrompt).toContain('msg-39');
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(distillProfile({ messages: TRANSCRIPT })).rejects.toThrow(
      /API key not configured/
    );
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('propagates token-limit error if the trimmed retry also fails with a token-limit error', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('maximum context'));
    await expect(distillProfile({ messages: TRANSCRIPT })).rejects.toThrow(
      /maximum context/
    );
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
