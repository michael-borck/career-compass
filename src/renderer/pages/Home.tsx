import { Link } from 'react-router-dom';

const ROUTES_TO_MIGRATE = [
  'careers', 'pitch', 'cover-letter', 'chat', 'career-story',
  'compare', 'gap-analysis', 'interview', 'learning-path',
  'odyssey', 'portfolio', 'resume-review', 'skills-mapping',
  'values', 'industry', 'board', 'settings', 'about',
];

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-paper text-ink">
      <h1 className="text-3xl font-semibold mb-2">Career Compass — Vite scaffold</h1>
      <p className="text-ink-muted mb-6">
        Phase 1 of the Vite migration. The routes below render a placeholder until each page is ported from <code className="bg-paper-warm px-1 rounded">app/</code>.
      </p>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ROUTES_TO_MIGRATE.map((r) => (
          <li key={r}>
            <Link
              to={`/${r}`}
              className="block px-3 py-2 rounded border border-border hover:bg-paper-warm"
            >
              /{r}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
