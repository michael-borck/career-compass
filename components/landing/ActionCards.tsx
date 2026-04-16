'use client';

import {
  Compass,
  Columns3,
  MessageCircle,
  SearchCheck,
  Route as RouteIcon,
  Mic,
  Sparkles,
  Users,
} from 'lucide-react';
import { useSessionStore } from '@/lib/session-store';
import type { GatedAction } from '@/lib/action-gate';
import type { ReactNode } from 'react';

type CardDef = {
  action: GatedAction | 'chat' | 'odyssey';
  icon: ReactNode;
  title: string;
  description: string;
  hover: string;
  path: string;
  preNavigate?: () => void;
};

type Props = {
  gatedPush: (action: GatedAction, path: string, preNavigate?: () => void) => void;
  onDirectPush: (path: string) => void;
};

function ActionCard({
  def,
  onClick,
}: {
  def: CardDef;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={def.hover}
      className='border border-border rounded-lg bg-paper p-5 hover:border-ink-muted transition-colors duration-[250ms] cursor-pointer text-left w-full'
    >
      <div className='text-accent mb-3'>{def.icon}</div>
      <h3 className='text-[var(--text-base)] font-semibold text-ink mb-1'>{def.title}</h3>
      <p className='text-[var(--text-sm)] text-ink-muted leading-snug'>{def.description}</p>
    </button>
  );
}

export default function ActionCards({ gatedPush, onDirectPush }: Props) {
  const store = useSessionStore();

  const discover: CardDef[] = [
    {
      action: 'careers',
      icon: <Compass className='w-5 h-5' />,
      title: 'Find my careers',
      description: 'Generate 6 personalised career paths.',
      hover: 'Great starting point if you have a resume or know your interests.',
      path: '/careers',
      preNavigate: () => store.setCareers(null),
    },
    {
      action: 'compare',
      icon: <Columns3 className='w-5 h-5' />,
      title: 'Compare careers',
      description: 'Side-by-side across seven dimensions.',
      hover: 'Quick compare from job titles, or rich compare from your generated careers.',
      path: '/compare',
      preNavigate: () =>
        store.setComparePrefill({
          seedTarget: store.jobAdvert.trim() || store.jobTitle.trim(),
        }),
    },
    {
      action: 'chat',
      icon: <MessageCircle className='w-5 h-5' />,
      title: 'Start chatting',
      description: 'Talk with the career advisor.',
      hover: 'Open-ended. Good if you are not sure where to begin.',
      path: '/chat',
    },
  ];

  const assess: CardDef[] = [
    {
      action: 'gaps',
      icon: <SearchCheck className='w-5 h-5' />,
      title: 'Gap analysis',
      description: 'What you have vs what you need.',
      hover: 'Needs a target role and a profile to compare against.',
      path: '/gap-analysis',
    },
    {
      action: 'learn',
      icon: <RouteIcon className='w-5 h-5' />,
      title: 'Learning path',
      description: 'Step-by-step plan to get job-ready.',
      hover: 'Needs a target role. Uses your profile for context if available.',
      path: '/learning-path',
    },
    {
      action: 'interview',
      icon: <Mic className='w-5 h-5' />,
      title: 'Practice interview',
      description: 'Simulate a job interview with feedback.',
      hover: 'Needs a target role. Uses your profile for richer questions.',
      path: '/interview',
    },
  ];

  const reflect: CardDef[] = [
    {
      action: 'odyssey',
      icon: <Sparkles className='w-5 h-5' />,
      title: 'Imagine three lives',
      description: 'Three alternative five-year futures.',
      hover: 'From the Designing Your Life framework. Works with or without a profile.',
      path: '/odyssey',
    },
    {
      action: 'board',
      icon: <Users className='w-5 h-5' />,
      title: 'Board of advisors',
      description: 'Four perspectives on your profile.',
      hover: 'Needs a profile. A recruiter, HR partner, manager, and mentor each weigh in.',
      path: '/board',
    },
  ];

  function handleClick(def: CardDef) {
    if (def.action === 'chat' || def.action === 'odyssey') {
      onDirectPush(def.path);
      return;
    }
    gatedPush(def.action as GatedAction, def.path, def.preNavigate);
  }

  function renderColumn(label: string, cards: CardDef[]) {
    return (
      <div>
        <div className='editorial-rule justify-center mb-3'>
          <span>{label}</span>
        </div>
        <div className='flex flex-col gap-3'>
          {cards.map((def) => (
            <ActionCard key={def.title} def={def} onClick={() => handleClick(def)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 mt-6'>
      {renderColumn('Discover', discover)}
      {renderColumn('Assess', assess)}
      {renderColumn('Reflect', reflect)}
    </div>
  );
}
