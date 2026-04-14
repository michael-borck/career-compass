'use client';

import { Fragment, useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/session-store';
import SourcesList from '@/components/results/SourcesList';
import { useSessionStore } from '@/lib/session-store';

type Props = { messages: ChatMessage[] };

export default function ChatMessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const chatSources = useSessionStore((s) => s.chatSources);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className='flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3'>
      {messages.map((m) => {
        if (m.kind === 'focus-marker' || m.kind === 'notice') {
          return (
            <div
              key={m.id}
              className='self-center text-[var(--text-xs)] text-ink-quiet uppercase tracking-[0.18em] py-2'
            >
              {m.content}
            </div>
          );
        }

        if (m.kind === 'attachment-summary') {
          return (
            <div
              key={m.id}
              className='self-center max-w-md border border-border bg-accent-soft rounded-lg px-4 py-2 text-[var(--text-sm)] text-ink'
            >
              📎 {m.content}
            </div>
          );
        }

        const isUser = m.role === 'user';
        return (
          <Fragment key={m.id}>
            <div
              className={`max-w-[75%] px-4 py-3 rounded-lg ${
                isUser
                  ? 'self-end bg-accent-soft text-ink'
                  : 'self-start bg-paper border border-border text-ink'
              }`}
            >
              <div className='whitespace-pre-wrap leading-relaxed'>{m.content}</div>
            </div>
            {m.role === 'assistant' && chatSources[m.id] && chatSources[m.id].length > 0 && (
              <SourcesList sources={chatSources[m.id]} compact />
            )}
          </Fragment>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
