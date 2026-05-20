export default function Footer() {
  return (
    <footer className="flex-shrink-0">
      <div className="custom-screen">
        <div className="py-3 border-t border-border items-center justify-between flex">
          <p className="text-ink-quiet text-[var(--text-xs)]">
            Career Compass &middot; part of the Buddy suite
          </p>
          <div className="flex items-center gap-x-6 text-ink-quiet text-[var(--text-xs)]">
            <a
              className="hover:text-accent transition-colors duration-[250ms]"
              href="https://github.com/michael-borck/career-compass"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="hover:text-accent transition-colors duration-[250ms]"
              href="https://github.com/michael-borck"
              target="_blank"
              rel="noreferrer"
            >
              @michael-borck
            </a>
            <a
              className="hover:text-accent transition-colors duration-[250ms]"
              href="https://x.com/Michael_Borck"
              target="_blank"
              rel="noreferrer"
            >
              @Michael_Borck
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
