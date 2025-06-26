'use client';

import Image from 'next/image';
import NavLink from './NavLink';

export default function Hero() {
  return (
    <section>
      <div className='custom-screen sm:pt-56 pt-28 text-gray-600 flex justify-between gap-8 sm:flex-row flex-col'>
        <div className='space-y-5 max-w-4xl mx-auto text-center sm:w-1/2'>
          <button
            className={`border py-2 rounded-2xl hover:bg-gray-100 transition px-5 text-sm text-gray-500 hover:text-gray-600`}
          >
            Privacy-first career exploration with AI
          </button>
          <h1 className='text-4xl text-gray-800 font-extrabold mx-auto sm:text-6xl'>
            Navigate your career path with AI guidance
          </h1>
          <p className='max-w-xl mx-auto'>
            Career Compass helps you discover career paths based on your skills
            and interests using <span className='font-semibold'>privacy-first AI</span> - 
            your data stays on your device.
          </p>
          <div className='flex items-center justify-center gap-x-3 font-medium text-sm'>
            <NavLink
              href='/careers'
              className='text-white bg-gray-800 hover:bg-gray-600 active:bg-gray-900 '
            >
              Find your career path
            </NavLink>
            <NavLink
              target='_blank'
              href='https://github.com/michael-borck/career-compass'
              className='text-gray-700 border hover:bg-gray-50'
              scroll={false}
            >
              Learn more
            </NavLink>
          </div>
        </div>
        <div className=''>
          <Image
            src='/careers-screenshot.png'
            className='rounded-2xl border'
            alt='hero'
            width={700}
            height={700}
          />
        </div>
      </div>
    </section>
  );
}
