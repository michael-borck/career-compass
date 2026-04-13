'use client';

export default function Hero() {
  return (
    <section>
      <div className='custom-screen sm:pt-32 pt-20 pb-4 text-center'>
        <span
          className='inline-block border border-border rounded-lg px-5 py-2 text-[var(--text-sm)] text-ink-muted mb-6'
        >
          Privacy-first career exploration with AI
        </span>
        <h1 className='text-[var(--text-display)] text-ink font-semibold leading-[1.1] tracking-[-0.015em] max-w-4xl mx-auto'>
          Your Career. Your Data. Your Direction.
        </h1>
        <p className='mt-5 max-w-2xl mx-auto text-ink-muted text-[var(--text-lg)] leading-relaxed'>
          AI-powered career exploration that never leaves your device.
        </p>
      </div>
    </section>
  );
}
