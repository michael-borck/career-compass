'use client';

import Link from 'next/link';
import { useSessionStore } from '@/lib/session-store';

export default function SessionBanner() {
  const store = useSessionStore();
  const {
    resumeText,
    resumeFilename,
    freeText,
    jobTitle,
    jobAdvert,
    careers,
    chatMessages,
    gapAnalysis,
    learningPath,
    interviewMessages,
    interviewFeedback,
    odysseyLives,
    boardReview,
    comparison,
    elevatorPitch,
    coverLetter,
    resumeReview,
    portfolio,
    careerStory,
  } = store;

  const hasResume = !!resumeText;
  const hasFreeText = !!freeText.trim();
  const hasJobTitle = !!jobTitle.trim();
  const hasJobAdvert = !!jobAdvert.trim();
  const hasAnyInput = hasResume || hasFreeText || hasJobTitle || hasJobAdvert;

  const hasCareers = !!(careers && careers.length > 0);
  const userMessageCount = chatMessages.filter(
    (m) => m.role === 'user' && m.kind === 'message'
  ).length;
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
  const hasComparison = !!comparison;
  const hasPitch = !!elevatorPitch;
  const hasCoverLetter = !!coverLetter;
  const hasResumeReview = !!resumeReview;
  const hasPortfolio = !!portfolio;
  const hasCareerStory = !!careerStory;
  const hasAnyOutput =
    hasCareers || hasChat || hasGap || hasPath ||
    hasInterviewInProgress || hasInterviewFeedback ||
    hasOdyssey || hasBoard || hasComparison ||
    hasPitch || hasCoverLetter || hasResumeReview || hasPortfolio || hasCareerStory;

  if (!hasAnyInput && !hasAnyOutput) return null;

  function handleStartOver() {
    if (!confirm('Start over? This clears your results but keeps your uploaded material.'))
      return;
    store.resetOutputs();
  }

  const pillClass =
    'inline-flex items-center gap-1 bg-paper border border-border rounded px-2 py-0.5 text-[var(--text-xs)] text-ink';
  const removeClass =
    'text-ink-quiet hover:text-ink cursor-pointer ml-1';

  return (
    <div className='w-full max-w-5xl mx-auto mt-8 border border-accent/30 bg-accent-soft rounded-lg px-5 py-3 flex items-center gap-4 flex-wrap'>
      <span className='block w-2 h-2 rounded-full bg-accent flex-shrink-0' />

      {hasAnyInput && (
        <div className='flex flex-wrap gap-x-2 gap-y-1 items-center'>
          <span className='text-[var(--text-xs)] text-ink-quiet'>Loaded:</span>
          {hasResume && (
            <span className={pillClass}>
              {resumeFilename ?? 'resume'}
              <button
                type='button'
                onClick={() => store.clearResume()}
                className={removeClass}
                aria-label='Remove resume'
              >
                ×
              </button>
            </span>
          )}
          {hasFreeText && (
            <span className={pillClass}>
              About you
              <button
                type='button'
                onClick={() => store.setFreeText('')}
                className={removeClass}
                aria-label='Remove about you'
              >
                ×
              </button>
            </span>
          )}
          {hasJobTitle && (
            <span className={pillClass}>
              Job title: {jobTitle.trim().slice(0, 30)}
              {jobTitle.trim().length > 30 ? '…' : ''}
              <button
                type='button'
                onClick={() => store.setJobTitle('')}
                className={removeClass}
                aria-label='Remove job title'
              >
                ×
              </button>
            </span>
          )}
          {hasJobAdvert && (
            <span className={pillClass}>
              Job advert
              <button
                type='button'
                onClick={() => store.setJobAdvert('')}
                className={removeClass}
                aria-label='Remove job advert'
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {hasAnyInput && hasAnyOutput && (
        <span className='text-ink-quiet'>·</span>
      )}

      {hasAnyOutput && (
        <div className='flex-1 text-[var(--text-xs)] text-ink flex flex-wrap gap-x-3 gap-y-1 items-center'>
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
          {hasComparison && (
            <Link href='/compare' className='underline hover:text-accent'>
              comparison ready
            </Link>
          )}
          {hasPitch && (
            <Link href='/pitch' className='underline hover:text-accent'>
              pitch ready
            </Link>
          )}
          {hasCoverLetter && (
            <Link href='/cover-letter' className='underline hover:text-accent'>
              cover letter ready
            </Link>
          )}
          {hasResumeReview && (
            <Link href='/resume-review' className='underline hover:text-accent'>
              resume review ready
            </Link>
          )}
          {hasPortfolio && (
            <Link href='/portfolio' className='underline hover:text-accent'>
              portfolio ready{portfolio!.target ? ` (${portfolio!.target})` : ''}
            </Link>
          )}
          {hasCareerStory && (
            <Link href='/career-story' className='underline hover:text-accent'>
              career story ready
            </Link>
          )}
        </div>
      )}

      {hasAnyOutput && (
        <button
          type='button'
          onClick={handleStartOver}
          className='text-[var(--text-xs)] text-ink-muted hover:text-ink flex-shrink-0'
        >
          Start over
        </button>
      )}
    </div>
  );
}
