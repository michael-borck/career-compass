import CTA from '@/components/CTA';
import GradientWrapper from '@/components/GradientWrapper';
import Hero from '@/components/Hero';
import UploadCard from '@/components/landing/UploadCard';
import ChatCard from '@/components/landing/ChatCard';

export default function Home() {
  return (
    <>
      <Hero />
      <section className='px-6 py-16 flex justify-center'>
        <div className='flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center items-stretch'>
          <UploadCard />
          <ChatCard />
        </div>
      </section>
      <GradientWrapper />
      <CTA />
    </>
  );
}
