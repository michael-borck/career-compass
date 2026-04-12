'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ChatCard() {
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
      <div className='flex-1' />
      <Button asChild className='w-full'>
        <Link href='/chat'>Start chatting</Link>
      </Button>
    </div>
  );
}
