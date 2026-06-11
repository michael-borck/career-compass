import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Columns3,
  MessageCircle,
  SearchCheck,
  Route as RouteIcon,
  Mic,
  Sparkles,
  Users,
  BookOpen,
  Presentation,
  FileText,
  ClipboardCheck,
  Globe,
  Grid3X3,
  Factory,
  Heart,
} from 'lucide-react';
import { useSessionStore } from '@/lib/session-store';
import type { ReactNode } from 'react';

type CardDef = {
  icon: ReactNode;
  title: string;
  description: string;
  hover: string;
  path: string;
  preNavigate?: () => void;
};

function ActionCard({
  def,
  onClick,
  capstone = false,
}: {
  def: CardDef;
  onClick: () => void;
  capstone?: boolean;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={def.hover}
      className={`border rounded-lg bg-paper p-5 transition-colors duration-[250ms] cursor-pointer text-left w-full ${
        capstone ? 'border-accent/60 hover:border-accent' : 'border-border hover:border-ink-muted'
      }`}
    >
      <div className='flex items-center justify-between mb-3'>
        <div className='text-accent'>{def.icon}</div>
        {capstone && (
          <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-accent'>
            Capstone
          </span>
        )}
      </div>
      <h3 className='text-[var(--text-base)] font-semibold text-ink mb-1'>{def.title}</h3>
      <p className='text-[var(--text-sm)] text-ink-muted leading-snug'>{def.description}</p>
    </button>
  );
}

export default function ActionCards() {
  const navigate = useNavigate();
  const store = useSessionStore();

  const discover: CardDef[] = [
    {
      icon: <Compass className='w-5 h-5' />,
      title: 'Find my careers',
      description: 'Generate 6 personalised career paths.',
      hover: 'Great starting point if you have a resume or know your interests.',
      path: '/careers',
      preNavigate: () => store.setCareers(null),
    },
    {
      icon: <Factory className='w-5 h-5' />,
      title: 'Explore an industry',
      description: 'What it’s like to work in a field.',
      hover:
        'Pick an industry and get key roles, entry points, growth areas, and honest challenges.',
      path: '/industry',
      preNavigate: () => store.setIndustryExploration(null),
    },
    {
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
  ];

  const assess: CardDef[] = [
    {
      icon: <SearchCheck className='w-5 h-5' />,
      title: 'Gap analysis',
      description: 'What you have vs what you need.',
      hover: 'Needs a target role and a profile to compare against.',
      path: '/gap-analysis',
    },
    {
      icon: <RouteIcon className='w-5 h-5' />,
      title: 'Learning path',
      description: 'Step-by-step plan to get job-ready.',
      hover: 'Needs a target role. Uses your profile for context if available.',
      path: '/learning-path',
    },
    {
      icon: <Grid3X3 className='w-5 h-5' />,
      title: 'Map my skills',
      description: 'Translate skills into professional frameworks.',
      hover:
        'Maps to SFIA, O*NET, ESCO, and AQF. Enriches gap analysis and learning paths if run first.',
      path: '/skills-mapping',
      preNavigate: () => store.setSkillsMapping(null),
    },
    {
      icon: <Mic className='w-5 h-5' />,
      title: 'Practice interview',
      description: 'Simulate a job interview with feedback.',
      hover: 'Needs a target role. Uses your profile for richer questions.',
      path: '/interview',
    },
  ];

  const reflect: CardDef[] = [
    {
      icon: <Sparkles className='w-5 h-5' />,
      title: 'Imagine three lives',
      description: 'Three alternative five-year futures.',
      hover: 'From the Designing Your Life framework. Works with or without a profile.',
      path: '/odyssey',
    },
    {
      icon: <Users className='w-5 h-5' />,
      title: 'Board of advisors',
      description: 'Four perspectives on your profile.',
      hover: 'Needs a profile. A recruiter, HR partner, manager, and mentor each weigh in.',
      path: '/board',
    },
    {
      icon: <Heart className='w-5 h-5' />,
      title: 'Values compass',
      description: 'Discover what matters most to you.',
      hover: 'Identify your core work values. Works with just a few words or a full profile.',
      path: '/values',
      preNavigate: () => store.setValuesCompass(null),
    },
    {
      icon: <BookOpen className='w-5 h-5' />,
      title: 'Career story',
      description: 'Find the thread connecting your experiences.',
      hover: 'Works best after using other features. Draws on your full session.',
      path: '/career-story',
    },
  ];

  const materials: CardDef[] = [
    {
      icon: <Presentation className='w-5 h-5' />,
      title: 'Elevator pitch',
      description: 'Write a 30-60 second pitch for networking.',
      hover: 'Works with any combination of profile and target role.',
      path: '/pitch',
    },
    {
      icon: <FileText className='w-5 h-5' />,
      title: 'Cover letter',
      description: 'Draft a professional letter for applications.',
      hover: 'Works best with a specific job advert.',
      path: '/cover-letter',
    },
    {
      icon: <ClipboardCheck className='w-5 h-5' />,
      title: 'Resume review',
      description: 'Get structured feedback on your resume.',
      hover: 'Needs a resume. Add a target role for tailored suggestions.',
      path: '/resume-review',
    },
    {
      icon: <Globe className='w-5 h-5' />,
      title: 'Portfolio page',
      description: 'Generate a personal portfolio website.',
      hover: 'Needs a resume or About you. Add a target role to tailor it.',
      path: '/portfolio',
    },
  ];

  function handleClick(def: CardDef) {
    def.preNavigate?.();
    navigate(def.path);
  }

  // The last card in each column is the pillar's capstone — it synthesizes
  // the activities above it and gets a distinct visual treatment.
  function renderColumn(label: string, cards: CardDef[]) {
    return (
      <div>
        <div className='editorial-rule justify-center mb-3'>
          <span>{label}</span>
        </div>
        <div className='flex flex-col gap-3'>
          {cards.map((def, i) => (
            <ActionCard
              key={def.title}
              def={def}
              capstone={i === cards.length - 1}
              onClick={() => handleClick(def)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='w-full max-w-5xl mt-6'>
      <button
        type='button'
        onClick={() => navigate('/chat')}
        title='Open-ended conversation with the career advisor. It can turn the chat into a profile and seed other activities.'
        className='w-full mb-8 border border-border rounded-lg bg-paper px-5 py-4 hover:border-ink-muted transition-colors duration-[250ms] cursor-pointer flex items-center justify-center gap-3 text-left'
      >
        <MessageCircle className='w-5 h-5 text-accent shrink-0' />
        <span className='text-[var(--text-base)] text-ink'>
          <span className='font-semibold'>Not sure where to start?</span>{' '}
          <span className='text-ink-muted'>Chat with the career advisor</span>
        </span>
      </button>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
        {renderColumn('Discover', discover)}
        {renderColumn('Assess', assess)}
        {renderColumn('Reflect', reflect)}
        {renderColumn('Materials', materials)}
      </div>
    </div>
  );
}
