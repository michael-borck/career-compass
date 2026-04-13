'use client';

import Image from 'next/image';

export default function Hero() {
  return (
    <section>
      <div className='custom-screen sm:pt-32 pt-20 pb-6'>
        <div className='grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-12 items-center'>
          <div className='text-center md:text-left'>
            <div className='inline-flex items-center gap-3 mb-8'>
              <span className='block w-9 h-px bg-accent' />
              <span className='text-[var(--text-xs)] font-medium uppercase tracking-[0.22em] text-ink-quiet'>
                A private place to explore your future
              </span>
            </div>
            <h1
              className='text-ink font-semibold leading-[1.05] tracking-[-0.02em]'
              style={{ fontSize: 'clamp(2.75rem, 6vw, 5.5rem)' }}
            >
              Your Career. Your Data.
              <br />
              <span className='italic text-accent font-normal'>Your Direction.</span>
            </h1>
            <p className='mt-7 max-w-xl mx-auto md:mx-0 text-ink-muted text-[var(--text-lg)] leading-relaxed'>
              AI-powered career exploration that never leaves your device.
              Upload a resume, tell us a job title, or talk it through with
              an advisor &mdash; whatever feels right.
            </p>
          </div>
          <div className='flex justify-center md:justify-end'>
            <Image
              src='/careers-screenshot.png'
              className='rounded-lg border border-border shadow-sm max-w-full h-auto'
              alt='Career paths visualization'
              width={700}
              height={700}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
