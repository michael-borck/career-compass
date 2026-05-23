import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the chat() client; use the REAL isTokenLimitError so the ladder is
// exercised against the actual detection heuristic.
vi.mock('./llm', () => ({ chat: vi.fn() }));

import { chat } from './llm';
import { callStructured, generate, type GenSpec } from './generate';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;
const reply = (content: string) => ({ content });
const tokenErr = () => new Error('context length exceeded');
const otherErr = () => new Error('boom');

beforeEach(() => mockChat.mockReset());

// A simple input the trim steps can transform, so we can assert which value
// each attempt was built from.
type In = { text: string };
const baseSpec = (overrides: Partial<GenSpec<In, string>> = {}): GenSpec<In, string> => ({
  input: { text: 'full' },
  buildMessages: (i) => [{ role: 'user', content: i.text }],
  parse: (raw) => raw,
  ...overrides,
});

describe('callStructured', () => {
  it('builds messages, calls chat, and parses the reply', async () => {
    mockChat.mockResolvedValueOnce(reply('parsed'));
    const out = await callStructured(baseSpec());
    expect(out).toBe('parsed');
    expect(mockChat).toHaveBeenCalledOnce();
    expect(mockChat.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'full' }]);
  });

  it('defaults response_format to json_object', async () => {
    mockChat.mockResolvedValueOnce(reply('{}'));
    await callStructured(baseSpec());
    expect(mockChat.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
  });

  it('omits response_format entirely for text mode', async () => {
    mockChat.mockResolvedValueOnce(reply('hi'));
    await callStructured(baseSpec({ responseFormat: { type: 'text' } }));
    expect('response_format' in mockChat.mock.calls[0][0]).toBe(false);
  });

  it('omits temperature unless set, and forwards it when set', async () => {
    mockChat.mockResolvedValue(reply('x'));
    await callStructured(baseSpec());
    expect('temperature' in mockChat.mock.calls[0][0]).toBe(false);
    await callStructured(baseSpec({ temperature: 0.5 }));
    expect(mockChat.mock.calls[1][0].temperature).toBe(0.5);
  });

  it('passes the current input to parse', async () => {
    mockChat.mockResolvedValueOnce(reply('raw'));
    const parse = vi.fn((raw: string) => raw);
    await callStructured(baseSpec({ parse }));
    expect(parse).toHaveBeenCalledWith('raw', { text: 'full' });
  });
});

describe('generate', () => {
  const ladder = {
    steps: [
      (i: In) => ({ text: `${i.text}-a` }),
      (i: In) => ({ text: `${i.text}-b` }),
    ],
    tooLongMessage: 'too long',
  };

  it('returns the result untrimmed when the first attempt succeeds', async () => {
    mockChat.mockResolvedValueOnce(reply('ok'));
    const out = await generate(baseSpec(), ladder);
    expect(out).toEqual({ result: 'ok', trimmed: false });
    expect(mockChat).toHaveBeenCalledOnce();
  });

  it('applies the first trim step and retries on a token-limit error', async () => {
    mockChat.mockRejectedValueOnce(tokenErr()).mockResolvedValueOnce(reply('ok'));
    const out = await generate(baseSpec(), ladder);
    expect(out).toEqual({ result: 'ok', trimmed: true });
    expect(mockChat.mock.calls[1][0].messages[0].content).toBe('full-a');
  });

  it('applies trim steps cumulatively in order', async () => {
    mockChat
      .mockRejectedValueOnce(tokenErr())
      .mockRejectedValueOnce(tokenErr())
      .mockResolvedValueOnce(reply('ok'));
    const out = await generate(baseSpec(), ladder);
    expect(out.trimmed).toBe(true);
    expect(mockChat.mock.calls.map((c) => c[0].messages[0].content)).toEqual([
      'full',
      'full-a',
      'full-a-b',
    ]);
  });

  it('throws tooLongMessage when the ladder is exhausted', async () => {
    // 2-step ladder => 3 attempts, all token-limited.
    mockChat
      .mockRejectedValueOnce(tokenErr())
      .mockRejectedValueOnce(tokenErr())
      .mockRejectedValueOnce(tokenErr());
    await expect(generate(baseSpec(), ladder)).rejects.toThrow('too long');
    expect(mockChat).toHaveBeenCalledTimes(3); // full, full-a, full-a-b
  });

  it('rethrows the last LLM error when no tooLongMessage is set', async () => {
    mockChat
      .mockRejectedValueOnce(tokenErr())
      .mockRejectedValueOnce(tokenErr())
      .mockRejectedValueOnce(tokenErr());
    await expect(
      generate(baseSpec(), { steps: ladder.steps })
    ).rejects.toThrow('context length exceeded');
  });

  it('rethrows a non-token-limit error immediately without trimming', async () => {
    mockChat.mockRejectedValueOnce(otherErr());
    await expect(generate(baseSpec(), ladder)).rejects.toThrow('boom');
    expect(mockChat).toHaveBeenCalledOnce();
  });

  it('handles an empty ladder by surrendering on the first token-limit error', async () => {
    mockChat.mockRejectedValueOnce(tokenErr());
    await expect(
      generate(baseSpec(), { steps: [], tooLongMessage: 'nope' })
    ).rejects.toThrow('nope');
    expect(mockChat).toHaveBeenCalledOnce();
  });
});
