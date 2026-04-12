import { describe, it, expect } from 'vitest';
import { trimHistory } from './chat-history';
import type { ChatMessage } from './session-store';

function msg(role: ChatMessage['role'], content: string, kind: ChatMessage['kind'] = 'message'): ChatMessage {
  return { id: Math.random().toString(), role, content, timestamp: Date.now(), kind };
}

describe('trimHistory', () => {
  it('returns all messages when under limit', () => {
    const msgs = [msg('user', 'a'), msg('assistant', 'b')];
    expect(trimHistory(msgs, 10)).toEqual(msgs);
  });

  it('keeps only the last N messages when over limit', () => {
    const msgs = Array.from({ length: 25 }, (_, i) => msg('user', `m${i}`));
    const trimmed = trimHistory(msgs, 10);
    expect(trimmed).toHaveLength(10);
    expect(trimmed[0].content).toBe('m15');
    expect(trimmed[9].content).toBe('m24');
  });

  it('always keeps attachment-summary messages regardless of position', () => {
    const msgs = [
      msg('system', 'attached resume', 'attachment-summary'),
      ...Array.from({ length: 25 }, (_, i) => msg('user', `m${i}`)),
    ];
    const trimmed = trimHistory(msgs, 10);
    expect(trimmed[0].kind).toBe('attachment-summary');
    expect(trimmed).toHaveLength(11); // 10 recent + 1 attachment
  });

  it('deduplicates if an attachment is already in the recent window', () => {
    const msgs = [
      msg('system', 'attached resume', 'attachment-summary'),
      msg('user', 'a'),
      msg('user', 'b'),
    ];
    const trimmed = trimHistory(msgs, 10);
    expect(trimmed).toHaveLength(3);
  });
});
