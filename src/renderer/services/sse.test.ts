import { describe, it, expect } from 'vitest';
import { createSSEParser, openAIDelta, anthropicDelta, geminiDelta } from './sse';

describe('createSSEParser', () => {
  it('emits each data payload from well-formed events', () => {
    const out: string[] = [];
    const push = createSSEParser((p) => out.push(p));
    push('data: {"a":1}\n\ndata: {"a":2}\n\n');
    expect(out).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('handles payloads split across arbitrary chunk boundaries', () => {
    const out: string[] = [];
    const push = createSSEParser((p) => out.push(p));
    push('da');
    push('ta: {"tok');
    push('en":"hi"}\nda');
    push('ta: {"token":"there"}\n');
    expect(out).toEqual(['{"token":"hi"}', '{"token":"there"}']);
  });

  it('swallows [DONE], ignores comments/event lines, strips CR', () => {
    const out: string[] = [];
    const push = createSSEParser((p) => out.push(p));
    push(': keepalive\nevent: message_stop\ndata: {"x":1}\r\ndata: [DONE]\n');
    expect(out).toEqual(['{"x":1}']);
  });
});

describe('delta extractors', () => {
  it('openAIDelta reads choices[0].delta.content and tolerates bookkeeping', () => {
    expect(openAIDelta({ choices: [{ delta: { content: 'hi' } }] })).toBe('hi');
    expect(openAIDelta({ choices: [{ delta: { role: 'assistant' } }] })).toBe('');
    expect(openAIDelta({})).toBe('');
  });

  it('anthropicDelta reads content_block_delta text only', () => {
    expect(anthropicDelta({ type: 'content_block_delta', delta: { text: 'hi' } })).toBe('hi');
    expect(anthropicDelta({ type: 'message_start' })).toBe('');
  });

  it('geminiDelta joins candidate parts', () => {
    expect(
      geminiDelta({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })
    ).toBe('ab');
    expect(geminiDelta({})).toBe('');
  });
});
