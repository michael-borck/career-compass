'use client';

import { Toaster } from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import ChatTopBar from '@/components/chat/ChatTopBar';
import ChatMessageList from '@/components/chat/ChatMessageList';

export default function ChatPage() {
  const messages = useSessionStore((s) => s.chatMessages);
  const userMessageCount = messages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const canGenerate = userMessageCount >= 3;

  function handleGenerateCareers() {
    // Wired in Task 20.
    alert('Profile review modal not yet implemented.');
  }

  return (
    <div className='h-[calc(100vh-4rem)] flex flex-col'>
      <ChatTopBar
        onGenerateCareers={handleGenerateCareers}
        canGenerate={canGenerate}
      />
      <ChatMessageList messages={messages} />
      <div className='border-t border-border px-6 py-4 text-ink-quiet text-[var(--text-sm)]'>
        Composer coming in the next task.
      </div>
      <Toaster />
    </div>
  );
}
