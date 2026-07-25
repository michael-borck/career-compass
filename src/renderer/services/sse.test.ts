import { describe, it, expect } from 'vitest';
import {
  createSSEParser,
  createNDJSONParser,
  openAIDelta,
  anthropicDelta,
  geminiDelta,
  ollamaNativeDelta,
} from './sse';

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

describe('createNDJSONParser', () => {
  it('emits each complete line, buffering across chunk boundaries', () => {
    const out: string[] = [];
    const push = createNDJSONParser((p) => out.push(p));
    push('{"a":1}\n{"b"');
    push(':2}\n');
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('skips blank lines and strips CR', () => {
    const out: string[] = [];
    const push = createNDJSONParser((p) => out.push(p));
    push('\n{"x":1}\r\n\n');
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

  it('ollamaNativeDelta reads message.content and ignores thinking', () => {
    expect(ollamaNativeDelta({ message: { content: 'hi', thinking: 'hmm' } })).toBe('hi');
    expect(ollamaNativeDelta({ message: { thinking: 'hmm' } })).toBe('');
    expect(ollamaNativeDelta({ done: true })).toBe('');
  });
});
