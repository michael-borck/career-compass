'use client';

import { useState } from 'react';
import Hero from '@/components/Hero';
import InputsZone, { NO_HINTS, type MissingHints } from '@/components/landing/InputsZone';
import ActionsZone from '@/components/landing/ActionsZone';
import OutputsBanner from '@/components/landing/OutputsBanner';

export default function Home() {
  const [missingHints, setMissingHints] = useState<MissingHints>(NO_HINTS);

  function clearMissingHints() {
    setMissingHints(NO_HINTS);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <OutputsBanner />
        <InputsZone missingHints={missingHints} onClearHints={clearMissingHints} />
        <ActionsZone setMissingHints={setMissingHints} clearMissingHints={clearMissingHints} />
      </section>
    </div>
  );
}
