'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSessionStore } from '@/lib/session-store';

export default function ChatCard() {
  const router = useRouter();
  const setPendingChatMessage = useSessionStore((s) => s.setPendingChatMessage);
  const [text, setText] = useState('');

  function handleStart() {
    const trimmed = text.trim();
    setPendingChatMessage(trimmed ? trimmed : null);
    router.push('/chat');
  }

  return (
    <div className='border border-border rounded-lg p-8 bg-paper flex flex-col gap-5 w-full max-w-xl'>
      <div>
        <h2 className='text-[var(--text-xl)] font-semibold text-ink mb-2'>
          Chat with an Advisor
        </h2>
        <p className='text-ink-muted text-[var(--text-sm)]'>
          Not sure where to start? Talk it through with a career advisor. You
          can attach a resume, text, or job title any time during the chat.
        </p>
      </div>

      <Textarea
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Say anything to start: a job title, what you're curious about, what's on your mind. Or leave blank and the advisor will open the conversation."
        className='flex-1 resize-none'
      />

      <Button onClick={handleStart} className='w-full'>
        Start chatting
      </Button>
    </div>
  );
}
