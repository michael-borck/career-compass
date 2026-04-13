'use client';

import toast, { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useSessionStore } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatComposer from '@/components/chat/ChatComposer';
import { loadLLMConfig, isLLMConfigured } from '@/lib/llm-client';

export default function ChatPage() {
  const store = useSessionStore();
  const messages = store.chatMessages;
  const [sending, setSending] = useState(false);

  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3;

  async function handleSend(text: string) {
    if (!(await isLLMConfigured())) {
      toast.error('Set up an LLM provider first.');
      return;
    }

    store.addChatMessage({ role: 'user', content: text });
    setSending(true);

    try {
      const llmConfig = await loadLLMConfig();
      // Snapshot messages AFTER the new user message was added.
      const currentMessages = useSessionStore.getState().chatMessages;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          currentFocus: useSessionStore.getState().currentFocus,
          llmConfig,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Chat failed');
      }

      const { reply, trimmed } = (await res.json()) as {
        reply: string;
        trimmed: boolean;
      };

      if (trimmed) {
        store.addChatMessage({
          role: 'system',
          kind: 'notice',
          content:
            'Earlier messages were trimmed to fit — I still have your resume and recent context.',
        });
      }

      store.addChatMessage({ role: 'assistant', content: reply });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Chat failed');
      store.addChatMessage({
        role: 'assistant',
        content:
          "The advisor couldn't respond — check your provider settings and try again.",
      });
    } finally {
      setSending(false);
    }
  }

  function handleGenerateCareers() {
    alert('Profile review modal — wired in Task 20.');
  }

  function handlePaperclip() {
    alert('Paperclip menu — wired in Task 19.');
  }

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={handleGenerateCareers}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <ChatComposer onSend={handleSend} onPaperclip={handlePaperclip} disabled={sending} />
      <Toaster />
    </div>
  );
}
