import { useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import { saveSessionToFile, loadSessionFromFile } from '@/lib/session-file';

export default function SessionBanner() {
  const store = useSessionStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLoadFile(file: File | undefined) {
    if (!file) return;
    try {
      loadSessionFromFile(await file.text());
      toast.success('Session loaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load that file.');
    }
  }
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
    industryExploration,
    skillsMapping,
    valuesCompass,
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
  const hasInterviewInProgress = interviewMessages.length > 0 && !hasInterviewFeedback;
  const hasOdyssey = Object.values(odysseyLives).some((life) => life.seed.trim() || life.headline);
  const hasBoard = !!boardReview;
  const hasComparison = !!comparison;
  const hasPitch = !!elevatorPitch;
  const hasCoverLetter = !!coverLetter;
  const hasResumeReview = !!resumeReview;
  const hasPortfolio = !!portfolio;
  const hasCareerStory = !!careerStory;
  const hasIndustry = !!industryExploration;
  const hasSkillsMapping = !!skillsMapping;
  const hasValues = !!valuesCompass;
  const hasAnyOutput =
    hasCareers ||
    hasChat ||
    hasGap ||
    hasPath ||
    hasInterviewInProgress ||
    hasInterviewFeedback ||
    hasOdyssey ||
    hasBoard ||
    hasComparison ||
    hasPitch ||
    hasCoverLetter ||
    hasResumeReview ||
    hasPortfolio ||
    hasCareerStory;

  if (!hasAnyInput && !hasAnyOutput) return null;

  // Journey tracker — mirrors the pillar/activity structure of ActionCards.
  // "Done" means the activity has a result in this session; the suggested
  // next step is the first incomplete activity in pillar order.
  const pillars = [
    {
      label: 'Discover',
      steps: [
        { title: 'Find my careers', path: '/careers', done: hasCareers },
        { title: 'Explore an industry', path: '/industry', done: hasIndustry },
        { title: 'Compare careers', path: '/compare', done: hasComparison },
      ],
    },
    {
      label: 'Assess',
      steps: [
        { title: 'Gap analysis', path: '/gap-analysis', done: hasGap },
        { title: 'Learning path', path: '/learning-path', done: hasPath },
        { title: 'Map my skills', path: '/skills-mapping', done: hasSkillsMapping },
        { title: 'Practice interview', path: '/interview', done: hasInterviewFeedback },
      ],
    },
    {
      label: 'Reflect',
      steps: [
        {
          title: 'Imagine three lives',
          path: '/odyssey',
          done: Object.values(odysseyLives).some((life) => !!life.headline),
        },
        { title: 'Board of advisors', path: '/board', done: hasBoard },
        { title: 'Values compass', path: '/values', done: hasValues },
        { title: 'Career story', path: '/career-story', done: hasCareerStory },
      ],
    },
    {
      label: 'Materials',
      steps: [
        { title: 'Elevator pitch', path: '/pitch', done: hasPitch },
        { title: 'Cover letter', path: '/cover-letter', done: hasCoverLetter },
        { title: 'Resume review', path: '/resume-review', done: hasResumeReview },
        { title: 'Portfolio page', path: '/portfolio', done: hasPortfolio },
      ],
    },
  ];
  const nextStep = pillars.flatMap((p) => p.steps).find((s) => !s.done) ?? null;

  function handleStartOver() {
    if (!confirm('Start over? This clears your results but keeps your uploaded material.')) return;
    store.resetOutputs();
  }

  const pillClass =
    'inline-flex items-center gap-1 bg-paper border border-border rounded px-2 py-0.5 text-[var(--text-xs)] text-ink';
  const removeClass = 'text-ink-quiet hover:text-ink cursor-pointer ml-1';

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

      {hasAnyInput && hasAnyOutput && <span className='text-ink-quiet'>·</span>}

      {hasAnyOutput && (
        <div className='flex-1 text-[var(--text-xs)] text-ink flex flex-wrap gap-x-3 gap-y-1 items-center'>
          <span className='text-ink-quiet'>You have:</span>
          {hasCareers && (
            <Link to='/careers' className='underline hover:text-accent'>
              {careers!.length} careers
            </Link>
          )}
          {hasChat && (
            <Link to='/chat' className='underline hover:text-accent'>
              {userMessageCount} chat message{userMessageCount === 1 ? '' : 's'}
            </Link>
          )}
          {hasGap && (
            <Link to='/gap-analysis' className='underline hover:text-accent'>
              gap analysis ready
            </Link>
          )}
          {hasPath && (
            <Link to='/learning-path' className='underline hover:text-accent'>
              learning path ready
            </Link>
          )}
          {hasInterviewInProgress && (
            <Link to='/interview' className='underline hover:text-accent'>
              interview in progress
            </Link>
          )}
          {hasInterviewFeedback && (
            <Link to='/interview' className='underline hover:text-accent'>
              interview feedback ready
            </Link>
          )}
          {hasOdyssey && (
            <Link to='/odyssey' className='underline hover:text-accent'>
              odyssey plan in progress
            </Link>
          )}
          {hasBoard && (
            <Link to='/board' className='underline hover:text-accent'>
              board review ready
            </Link>
          )}
          {hasComparison && (
            <Link to='/compare' className='underline hover:text-accent'>
              comparison ready
            </Link>
          )}
          {hasPitch && (
            <Link to='/pitch' className='underline hover:text-accent'>
              pitch ready
            </Link>
          )}
          {hasCoverLetter && (
            <Link to='/cover-letter' className='underline hover:text-accent'>
              cover letter ready
            </Link>
          )}
          {hasResumeReview && (
            <Link to='/resume-review' className='underline hover:text-accent'>
              resume review ready
            </Link>
          )}
          {hasPortfolio && (
            <Link to='/portfolio' className='underline hover:text-accent'>
              portfolio ready{portfolio!.target ? ` (${portfolio!.target})` : ''}
            </Link>
          )}
          {hasCareerStory && (
            <Link to='/career-story' className='underline hover:text-accent'>
              career story ready
            </Link>
          )}
        </div>
      )}

      <div className='flex items-center gap-3 flex-shrink-0 text-[var(--text-xs)]'>
        <button
          type='button'
          onClick={() => saveSessionToFile()}
          className='text-ink-muted hover:text-ink'
          title='Save this session to a file you can move between machines'
        >
          Save session
        </button>
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='text-ink-muted hover:text-ink'
          title='Load a previously saved session file'
        >
          Load session
        </button>
        <input
          ref={fileInputRef}
          type='file'
          accept='.json,application/json'
          className='hidden'
          aria-label='Load session file'
          onChange={(e) => {
            void handleLoadFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {hasAnyOutput && (
          <button type='button' onClick={handleStartOver} className='text-ink-muted hover:text-ink'>
            Start over
          </button>
        )}
      </div>

      <div className='w-full flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--text-xs)] pt-2 border-t border-accent/20'>
        <span className='text-ink-quiet'>Journey:</span>
        {pillars.map((pillar) => {
          const done = pillar.steps.filter((s) => s.done).length;
          const complete = done === pillar.steps.length;
          return (
            <span key={pillar.label} className={complete ? 'text-accent' : 'text-ink'}>
              {pillar.label} {done}/{pillar.steps.length}
            </span>
          );
        })}
        {nextStep && (
          <>
            <span className='text-ink-quiet'>·</span>
            <span className='text-ink-quiet'>Next:</span>
            <Link to={nextStep.path} className='underline hover:text-accent'>
              {nextStep.title} →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
