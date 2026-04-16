'use client';

export default function Hero() {
  return (
    <section>
      <div className='custom-screen pt-14 sm:pt-20 pb-8 text-center'>
        <h1
          className='text-ink font-semibold leading-[1.1] tracking-[-0.02em] max-w-4xl mx-auto'
          style={{ fontSize: 'clamp(2.25rem, 4.5vw, 3.75rem)' }}
        >
          Your Career.{' '}
          <span className='italic text-accent font-normal'>Your Direction.</span>
        </h1>
        <p className='mt-5 max-w-xl mx-auto text-ink-muted text-[var(--text-base)] leading-relaxed'>
          Explore what's possible. Understand what it takes. Reflect on what fits.
        </p>
      </div>
    </section>
  );
}
