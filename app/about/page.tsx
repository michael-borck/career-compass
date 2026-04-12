import { Shield, Bot, FileText, Target } from 'lucide-react';

export default function About() {
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="space-y-12">

        {/* Header */}
        <div className="text-center">
          <div className="editorial-rule justify-center">
            <span>About</span>
          </div>
          <h1 className="text-[var(--text-3xl)] font-semibold text-ink mb-4">About Career Compass</h1>
          <p className="text-[var(--text-xl)] text-ink-muted max-w-3xl mx-auto">
            Your privacy-first career exploration companion powered by AI
          </p>
        </div>

        {/* Mission */}
        <div className="bg-accent-soft border border-accent/20 rounded-lg p-8">
          <h2 className="text-[var(--text-2xl)] font-semibold text-ink mb-4">Our mission</h2>
          <p className="text-ink-muted text-[var(--text-lg)] leading-relaxed">
            Career Compass empowers individuals to explore career paths that align with their skills and interests,
            all while maintaining complete privacy and data ownership. Your personal information never leaves your device.
          </p>
        </div>

        {/* Features */}
        <div>
          <div className="editorial-rule">
            <span>Features</span>
          </div>
          <h2 className="text-[var(--text-2xl)] font-semibold text-ink mb-6">What Career Compass does</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-border rounded-lg p-6 hover:border-ink-muted transition-colors duration-[250ms]">
              <Shield className="w-6 h-6 text-accent mb-3" />
              <h3 className="font-semibold text-[var(--text-lg)] mb-2 text-ink">Privacy-first</h3>
              <p className="text-ink-muted leading-relaxed">
                All file processing happens locally on your device. Your resume and personal data never touch our servers.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6 hover:border-ink-muted transition-colors duration-[250ms]">
              <Bot className="w-6 h-6 text-accent mb-3" />
              <h3 className="font-semibold text-[var(--text-lg)] mb-2 text-ink">Multiple AI providers</h3>
              <p className="text-ink-muted leading-relaxed">
                Choose from OpenAI, Claude, Gemini, Groq, or run models locally with Ollama.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6 hover:border-ink-muted transition-colors duration-[250ms]">
              <FileText className="w-6 h-6 text-accent mb-3" />
              <h3 className="font-semibold text-[var(--text-lg)] mb-2 text-ink">Multiple file formats</h3>
              <p className="text-ink-muted leading-relaxed">
                Upload your resume in PDF, Markdown, or DOCX format for analysis.
              </p>
            </div>
            <div className="border border-border rounded-lg p-6 hover:border-ink-muted transition-colors duration-[250ms]">
              <Target className="w-6 h-6 text-accent mb-3" />
              <h3 className="font-semibold text-[var(--text-lg)] mb-2 text-ink">Personalised insights</h3>
              <p className="text-ink-muted leading-relaxed">
                Get tailored career recommendations based on your unique background and interests.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Commitment */}
        <div className="border-l-2 border-accent p-6 bg-paper">
          <h2 className="text-[var(--text-2xl)] font-semibold text-ink mb-4">Privacy commitment</h2>
          <div className="space-y-3 text-ink-muted">
            <p className="flex items-start">
              <span className="text-accent mr-2 font-medium">&#10003;</span>
              <span>No data collection &mdash; your files are processed entirely on your device</span>
            </p>
            <p className="flex items-start">
              <span className="text-accent mr-2 font-medium">&#10003;</span>
              <span>No external tracking or analytics</span>
            </p>
            <p className="flex items-start">
              <span className="text-accent mr-2 font-medium">&#10003;</span>
              <span>Secret keys stored locally on your computer only</span>
            </p>
            <p className="flex items-start">
              <span className="text-accent mr-2 font-medium">&#10003;</span>
              <span>Open source &mdash; inspect the code yourself</span>
            </p>
          </div>
        </div>

        {/* Technology */}
        <div>
          <div className="editorial-rule">
            <span>Technology</span>
          </div>
          <h2 className="text-[var(--text-2xl)] font-semibold text-ink mb-6">Built with</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="font-medium text-ink">Next.js</div>
              <div className="text-[var(--text-sm)] text-ink-quiet">Frontend</div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="font-medium text-ink">TypeScript</div>
              <div className="text-[var(--text-sm)] text-ink-quiet">Type safety</div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="font-medium text-ink">Tailwind CSS</div>
              <div className="text-[var(--text-sm)] text-ink-quiet">Styling</div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="font-medium text-ink">React Flow</div>
              <div className="text-[var(--text-sm)] text-ink-quiet">Visualisation</div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-paper-warm rounded-lg p-8">
          <h2 className="text-[var(--text-2xl)] font-semibold text-ink mb-6 text-center">Get in touch</h2>
          <div className="flex justify-center space-x-8">
            <a
              href="https://github.com/michael-borck/career-compass"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-ink-muted hover:text-accent transition-colors duration-[250ms]"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub project</span>
            </a>
            <a
              href="https://github.com/michael-borck"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-ink-muted hover:text-accent transition-colors duration-[250ms]"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>@michael-borck</span>
            </a>
            <a
              href="https://x.com/Michael_Borck"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-ink-muted hover:text-accent transition-colors duration-[250ms]"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>@Michael_Borck</span>
            </a>
          </div>
        </div>

        {/* Attribution */}
        <div className="bg-paper-warm rounded-lg p-6">
          <h2 className="text-[var(--text-xl)] font-semibold text-ink mb-4 text-center">Acknowledgements</h2>
          <div className="text-center space-y-2">
            <p className="text-ink-muted">
              Career Compass is forked from and inspired by{' '}
              <a
                href="https://github.com/Nutlope/explorecareers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline font-medium"
              >
                ExploreCareers
              </a>
            </p>
            <p className="text-[var(--text-sm)] text-ink-quiet">
              Created by Hassan El Mghari and Youssef Hasboun
            </p>
            <p className="text-[var(--text-sm)] text-ink-quiet">
              Enhanced for privacy-first desktop use with multi-LLM support and local processing
            </p>
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-ink-quiet text-[var(--text-xs)]">
          <p>Career Compass &middot; part of the Buddy suite</p>
        </div>

      </div>
    </div>
  );
}
