'use client';

import { useRouter } from 'next/navigation';
import Hero from '@/components/Hero';
import ActionCards from '@/components/landing/ActionCards';
import SessionBanner from '@/components/landing/SessionBanner';
import MissingInputsModal from '@/components/MissingInputsModal';
import { useGatedNavigate } from '@/lib/use-gated-navigate';

export default function Home() {
  const router = useRouter();
  const { gatedPush, modalProps } = useGatedNavigate();

  function onDirectPush(path: string) {
    router.push(path);
  }

  return (
    <div className='h-full overflow-y-auto'>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <ActionCards gatedPush={gatedPush} onDirectPush={onDirectPush} />
        <SessionBanner />
      </section>
      <MissingInputsModal {...modalProps} />
    </div>
  );
}
