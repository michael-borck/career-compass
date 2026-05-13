import { Link, useLocation } from 'react-router-dom';

export default function NotMigrated() {
  const location = useLocation();
  return (
    <main className="min-h-screen p-8 bg-paper text-ink">
      <h1 className="text-2xl font-semibold mb-2">Not yet migrated</h1>
      <p className="text-ink-muted mb-4">
        Route <code className="bg-paper-warm px-1 rounded">{location.pathname}</code> hasn&apos;t been ported from the Next.js codebase yet.
      </p>
      <Link to="/" className="text-accent underline">
        ← Back to scaffold home
      </Link>
    </main>
  );
}
