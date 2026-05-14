import { Link } from 'react-router-dom';

type CardDef = {
  title: string;
  description: string;
  path: string;
  ported?: boolean;
};

const SECTIONS: { label: string; cards: CardDef[] }[] = [
  {
    label: 'Discover',
    cards: [
      { title: 'Find my careers', description: 'Generate 6 personalised career paths.', path: '/careers' },
      { title: 'Compare careers', description: 'Side-by-side across seven dimensions.', path: '/compare' },
      { title: 'Explore an industry', description: 'What it’s like to work in a field.', path: '/industry' },
      { title: 'Start chatting', description: 'Talk with the career advisor.', path: '/chat' },
    ],
  },
  {
    label: 'Assess',
    cards: [
      { title: 'Gap analysis', description: 'What you have vs what you need.', path: '/gap-analysis' },
      { title: 'Learning path', description: 'Step-by-step plan to get job-ready.', path: '/learning-path' },
      { title: 'Map my skills', description: 'Translate skills into professional frameworks.', path: '/skills-mapping' },
      { title: 'Practice interview', description: 'Simulate a job interview with feedback.', path: '/interview' },
    ],
  },
  {
    label: 'Reflect',
    cards: [
      { title: 'Imagine three lives', description: 'Three alternative five-year futures.', path: '/odyssey' },
      { title: 'Board of advisors', description: 'Four perspectives on your profile.', path: '/board' },
      { title: 'Values compass', description: 'Discover what matters most to you.', path: '/values' },
      { title: 'Career story', description: 'Find the thread connecting your experiences.', path: '/career-story' },
    ],
  },
  {
    label: 'Materials',
    cards: [
      { title: 'Elevator pitch', description: 'Write a 30–60 second pitch for networking.', path: '/pitch' },
      { title: 'Cover letter', description: 'Draft a professional letter for applications.', path: '/cover-letter' },
      { title: 'Resume review', description: 'Get structured feedback on your resume.', path: '/resume-review' },
      { title: 'Portfolio page', description: 'Generate a personal portfolio website.', path: '/portfolio' },
    ],
  },
];

const OTHER: CardDef[] = [
  { title: 'Settings', description: 'Provider, API keys, model preferences.', path: '/settings', ported: true },
  { title: 'About', description: 'Privacy notes and project background.', path: '/about' },
];

function Card({ def }: { def: CardDef }) {
  const ported = def.ported === true;
  return (
    <Link
      to={def.path}
      className={
        'block border rounded-lg p-4 transition-colors ' +
        (ported
          ? 'bg-paper border-border hover:border-ink-muted'
          : 'bg-paper border-border opacity-70 hover:opacity-100 hover:border-ink-muted')
      }
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-ink">{def.title}</h3>
        {!ported && (
          <span className="text-[10px] uppercase tracking-wide text-ink-quiet border border-border rounded px-1.5 py-0.5 shrink-0">
            stub
          </span>
        )}
      </div>
      <p className="text-sm text-ink-muted leading-snug">{def.description}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold mb-1">Career Compass</h1>
          <p className="text-ink-muted">
            Vite scaffold — Phase 1 of the migration from Next.js. Cards marked <span className="text-ink-quiet">stub</span> route to a placeholder until the page is ported.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECTIONS.map((section) => (
            <section key={section.label}>
              <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-3">{section.label}</h2>
              <div className="flex flex-col gap-3">
                {section.cards.map((def) => (
                  <Card key={def.path} def={def} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 pt-6 border-t border-border">
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-3">Other</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            {OTHER.map((def) => (
              <Card key={def.path} def={def} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
