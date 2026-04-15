'use client';

import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';

export default function OutputsBanner() {
  const store = useSessionStore();
  const {
    chatMessages,
    careers,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
    odysseyLives,
    boardReview,
  } = store;

  const userMessageCount = chatMessages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
  const hasCareers = !!(careers && careers.length > 0);
  const hasChat = userMessageCount > 0;
  const hasGap = !!gapAnalysis;
  const hasPath = !!learningPath;
  const hasInterviewFeedback = !!interviewFeedback;
  const hasInterviewInProgress =
    interviewMessages.length > 0 && !hasInterviewFeedback;
  const hasOdyssey = Object.values(odysseyLives).some(
    (life) => life.seed.trim() || life.headline
  );
  const hasBoard = !!boardReview;

  if (
    !hasCareers &&
    !hasChat &&
    !hasGap &&
    !hasPath &&
    !hasInterviewInProgress &&
    !hasInterviewFeedback &&
    !hasOdyssey &&
    !hasBoard
  ) return null;

  function handleStartOver() {
    if (!confirm('Start over? This clears your current session.')) return;
    store.reset();
  }

  return (
    <div className='w-full max-w-3xl mx-auto mb-6 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4 flex-wrap'>
      <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />
      <div className='flex-1 text-[var(--text-sm)] text-ink flex flex-wrap gap-x-3 gap-y-1 items-center'>
        <span className='text-ink-quiet'>You have:</span>
        {hasCareers && (
          <Link href='/careers' className='underline hover:text-accent'>
            {careers!.length} careers
          </Link>
        )}
        {hasChat && (
          <Link href='/chat' className='underline hover:text-accent'>
            {userMessageCount} chat message{userMessageCount === 1 ? '' : 's'}
          </Link>
        )}
        {hasGap && (
          <Link href='/gap-analysis' className='underline hover:text-accent'>
            gap analysis ready
          </Link>
        )}
        {hasPath && (
          <Link href='/learning-path' className='underline hover:text-accent'>
            learning path ready
          </Link>
        )}
        {hasInterviewInProgress && (
          <Link href='/interview' className='underline hover:text-accent'>
            interview in progress
          </Link>
        )}
        {hasInterviewFeedback && (
          <Link href='/interview' className='underline hover:text-accent'>
            interview feedback ready
          </Link>
        )}
        {hasOdyssey && (
          <Link href='/odyssey' className='underline hover:text-accent'>
            odyssey plan in progress
          </Link>
        )}
        {hasBoard && (
          <Link href='/board' className='underline hover:text-accent'>
            board review ready
          </Link>
        )}
      </div>
      <button
        onClick={handleStartOver}
        className='text-[var(--text-sm)] text-ink-muted hover:text-ink'
      >
        Start over
      </button>
    </div>
  );
}
