'use client';

import Image from 'next/image';
import NavLink from './NavLink';

export default function Hero() {
  return (
    <section>
      <div className='custom-screen sm:pt-56 pt-28 flex justify-between gap-8 sm:flex-row flex-col'>
        <div className='space-y-5 max-w-4xl mx-auto text-center sm:w-1/2'>
          <span
            className='inline-block border border-border rounded-lg px-5 py-2 text-[var(--text-sm)] text-ink-muted'
          >
            Privacy-first career exploration with AI
          </span>
          <h1 className='text-[var(--text-display)] text-ink font-semibold leading-[1.1] tracking-[-0.015em] mx-auto'>
            Navigate your career path with AI guidance
          </h1>
          <p className='max-w-xl mx-auto text-ink-muted text-[var(--text-lg)] leading-relaxed'>
            Career Compass helps you discover career paths based on your skills
            and interests using <span className='font-medium text-ink'>privacy-first AI</span> &mdash;
            your data stays on your device.
          </p>
          <div className='flex items-center justify-center gap-x-3 font-medium text-base'>
            <NavLink
              href='/careers'
              className='bg-ink text-paper hover:bg-accent'
            >
              Find your career path
            </NavLink>
            <NavLink
              target='_blank'
              href='https://github.com/michael-borck/career-compass'
              className='text-ink border border-border hover:border-ink-muted'
              scroll={false}
            >
              Learn more
            </NavLink>
          </div>
        </div>
        <div>
          <Image
            src='/careers-screenshot.png'
            className='rounded-lg border border-border'
            alt='Career paths visualization'
            width={700}
            height={700}
          />
        </div>
      </div>
    </section>
  );
}
