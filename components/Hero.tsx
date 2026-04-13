'use client';

export default function Hero() {
  return (
    <section>
      <div className='custom-screen sm:pt-40 pt-24 pb-6 text-center'>
        <div className='inline-flex items-center gap-3 mb-10'>
          <span className='block w-9 h-px bg-accent' />
          <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.22em] text-ink-quiet'>
            A private place to explore your future
          </span>
          <span className='block w-9 h-px bg-accent' />
        </div>
        <h1
          className='text-ink font-semibold leading-[1.05] tracking-[-0.02em] max-w-5xl mx-auto'
          style={{ fontSize: 'clamp(3rem, 7vw, 6rem)' }}
        >
          Your Career. Your Data.
          <br />
          <span className='italic text-accent font-normal'>Your Direction.</span>
        </h1>
        <p className='mt-8 max-w-2xl mx-auto text-ink-muted text-[var(--text-lg)] leading-relaxed'>
          AI-powered career exploration that never leaves your device.
          Upload a resume, tell us a job title, or talk it through with an
          advisor &mdash; whatever feels right.
        </p>
      </div>
    </section>
  );
}
