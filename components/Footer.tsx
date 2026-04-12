const Footer = () => (
  <footer>
    <div className='custom-screen pt-16'>
      <div className='mt-10 py-8 border-t border-border items-center justify-between flex'>
        <p className='text-ink-quiet text-[var(--text-xs)]'>
          Career Compass &middot; part of the Buddy suite
        </p>
        <div className='flex items-center gap-x-6 text-ink-quiet text-[var(--text-xs)]'>
          <a
            className='hover:text-accent transition-colors duration-[250ms]'
            href='https://github.com/michael-borck/career-compass'
            target='_blank'
          >
            GitHub
          </a>
          <a
            className='hover:text-accent transition-colors duration-[250ms]'
            href='https://github.com/michael-borck'
            target='_blank'
          >
            @michael-borck
          </a>
          <a
            className='hover:text-accent transition-colors duration-[250ms]'
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
