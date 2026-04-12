import type { ChatMessage } from './session-store';

/**
 * Returns the last `keep` messages. Attachment-summary messages earlier in
 * the history are prepended so the advisor never loses the resume anchor.
 * Preserves ordering and deduplicates anything already in the recent window.
 */
export function trimHistory(messages: ChatMessage[], keep: number): ChatMessage[] {
  if (messages.length <= keep) return messages.slice();

  const recent = messages.slice(-keep);
  const recentIds = new Set(recent.map((m) => m.id));

  const olderAttachments = messages
    .slice(0, messages.length - keep)
    .filter((m) => m.kind === 'attachment-summary' && !recentIds.has(m.id));

  return [...olderAttachments, ...recent];
}
