import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import ActionCards from '../components/ActionCards';
import SessionBanner from '../components/SessionBanner';
import OllamaSetupCard from '../components/OllamaSetupCard';
import { isConfigured } from '../services/llm';

export default function Home() {
  // null = still checking (render nothing extra to avoid a flash).
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => setNeedsSetup(!(await isConfigured())))();
  }, []);

  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        {needsSetup === true && <OllamaSetupCard onConnected={() => setNeedsSetup(false)} />}
        <ActionCards />
        <SessionBanner />
      </section>
    </div>
  );
}
