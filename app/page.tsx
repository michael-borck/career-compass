import Hero from '@/components/Hero';
import UploadCard from '@/components/landing/UploadCard';
import ChatCard from '@/components/landing/ChatCard';
import SessionBanner from '@/components/landing/SessionBanner';

export default function Home() {
  return (
    <>
      <Hero />
      <section className='px-6 pb-16 flex flex-col items-center'>
        <SessionBanner />
        <div className='flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center items-stretch'>
          <UploadCard />
          <ChatCard />
        </div>
      </section>
    </>
  );
}
