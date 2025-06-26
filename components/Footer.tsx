const Footer = () => (
  <footer>
    <div className='custom-screen pt-16'>
      <div className='mt-10 py-10 border-t items-center justify-between flex'>
        <p className='text-gray-600'>
          Career Compass - Privacy-first career exploration
        </p>
        <div className='flex items-center gap-x-6 text-gray-400'>
          <a
            className='hover:underline transition'
            href='https://github.com/michael-borck/career-compass'
            target='_blank'
          >
            GitHub
          </a>
          <a
            className='hover:underline transition'
            href='https://github.com/michael-borck'
            target='_blank'
          >
            @michael-borck
          </a>
          <a
            className='hover:underline transition'
            href='https://x.com/Michael_Borck'
            target='_blank'
          >
            @Michael_Borck
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
