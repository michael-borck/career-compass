import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();
  return (
    <main className='min-h-screen p-8 bg-paper text-ink'>
      <h1 className='text-2xl font-semibold mb-2'>Page not found</h1>
      <p className='text-ink-muted mb-4'>
        There&apos;s nothing at{' '}
        <code className='bg-paper-warm px-1 rounded'>{location.pathname}</code>.
      </p>
      <Link to='/' className='text-accent underline'>
        ← Back to home
      </Link>
    </main>
  );
}
