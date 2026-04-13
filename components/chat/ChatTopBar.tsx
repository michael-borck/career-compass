'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/lib/session-store';

type Props = {
  onGenerateCareers: () => void;
  canGenerate: boolean;
};

export default function ChatTopBar({ onGenerateCareers, canGenerate }: Props) {
  const router = useRouter();
  const currentFocus = useSessionStore((s) => s.currentFocus);
  const setFocus = useSessionStore((s) => s.setFocus);
  const addChatMessage = useSessionStore((s) => s.addChatMessage);
  const reset = useSessionStore((s) => s.reset);

  function clearFocus() {
    setFocus(null);
    addChatMessage({
      role: 'system',
      kind: 'focus-marker',
      content: '— focus cleared —',
    });
  }

  function startOver() {
    if (!confirm('Start over? This clears your session.')) return;
    reset();
    router.push('/');
  }

  return (
    <div className='border-b border-border px-6 py-4 flex items-center gap-4'>
      <h1 className='text-[var(--text-lg)] font-semibold text-ink'>
        Career Advisor
      </h1>
      {currentFocus && (
        <span className='inline-flex items-center gap-2 border border-accent/30 bg-accent-soft text-ink text-[var(--text-sm)] px-3 py-1 rounded-full'>
          Focused on: {currentFocus}
          <button
            onClick={clearFocus}
            className='text-ink-quiet hover:text-ink'
            aria-label='Clear focus'
          >
            <X className='w-3 h-3' />
          </button>
        </span>
      )}
      <div className='flex-1' />
      <Button
        onClick={onGenerateCareers}
        disabled={!canGenerate}
      >
        Generate careers from this chat →
      </Button>
      <Button variant='outline' onClick={startOver}>
        Start over
      </Button>
    </div>
  );
}
