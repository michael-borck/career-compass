import toast from 'react-hot-toast';
import { useSessionStore } from '@/lib/session-store';
import { loadSampleProfile } from '@/lib/sample-data';

export default function Hero() {
  const hasProfile = useSessionStore((s) => !!s.resumeText || !!s.freeText.trim());

  function handleLoadSample() {
    loadSampleProfile();
    toast.success('Sample profile loaded — try any activity below.');
  }

  return (
    <section>
      <div className='custom-screen pt-14 sm:pt-20 pb-8 text-center'>
        <h1
          className='text-ink font-semibold leading-[1.1] tracking-[-0.02em] max-w-4xl mx-auto'
          style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)' }}
        >
          Your Career. <span className='italic text-accent font-normal'>Your Direction.</span>
        </h1>
        <p className='mt-5 max-w-xl mx-auto text-ink-muted text-[var(--text-base)] leading-relaxed'>
          Explore what's possible. Understand what it takes. Reflect on what fits. Build what you
          need.
        </p>
        {!hasProfile && (
          <p className='mt-4 text-[var(--text-sm)] text-ink-quiet'>
            Just exploring?{' '}
            <button
              type='button'
              onClick={handleLoadSample}
              className='underline hover:text-accent'
            >
              Load a sample profile
            </button>{' '}
            and try any activity.
          </p>
        )}
      </div>
    </section>
  );
}
