'use client';

import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';

export default function SessionBanner() {
  const store = useSessionStore();
  const {
    resumeText,
    freeText,
    jobTitle,
    chatMessages,
    careers,
    distilledProfile,
  } = store;

  const userMessageCount = chatMessages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const hasCareers = !!(careers && careers.length > 0);
  const hasChat = userMessageCount > 0;
  const hasInputs =
    !!resumeText || !!freeText.trim() || !!jobTitle.trim() || !!distilledProfile;

  const hasSession = hasCareers || hasChat || hasInputs;
  if (!hasSession) return null;

  // Where does "Continue" go? Prefer the most finished surface.
  const continueHref = hasCareers ? '/careers' : hasChat ? '/chat' : '/careers';

  const parts: string[] = [];
  if (hasChat) parts.push(`${userMessageCount} chat message${userMessageCount === 1 ? '' : 's'}`);
  if (hasCareers) parts.push(`${careers!.length} careers`);
  if (hasInputs && !hasChat && !hasCareers) parts.push('inputs ready');

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
  }

  return (
    <div className='mx-auto w-full max-w-3xl mb-6 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4'>
      <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />
      <div className='flex-1 text-[var(--text-sm)] text-ink'>
        Session in progress — {parts.join(', ') || 'ready to go'}.
      </div>
      <Link
        href={continueHref}
        className='text-[var(--text-sm)] font-medium text-ink underline hover:text-accent'
      >
        Continue →
      </Link>
      <button
        onClick={handleStartOver}
        className='text-[var(--text-sm)] text-ink-muted hover:text-ink'
      >
        Start over
      </button>
    </div>
  );
}
