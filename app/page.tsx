'use client';

import Hero from '@/components/Hero';
import ActionCards from '@/components/landing/ActionCards';
import SessionBanner from '@/components/landing/SessionBanner';

export default function Home() {
  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <ActionCards />
        <SessionBanner />
      </section>
    </div>
  );
}
