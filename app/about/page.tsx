export default function About() {
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="space-y-12">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">About Career Compass</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Your privacy-first career exploration companion powered by AI
          </p>
        </div>

        {/* Mission */}
        <div className="bg-blue-50 rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-blue-900 mb-4">Our Mission</h2>
          <p className="text-blue-800 text-lg leading-relaxed">
            Career Compass empowers individuals to explore career paths that align with their skills and interests, 
            all while maintaining complete privacy and data ownership. Your personal information never leaves your device.
          </p>
        </div>

        {/* Features */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="text-green-600 text-2xl mb-3">🔒</div>
              <h3 className="font-semibold text-lg mb-2">Privacy-First</h3>
              <p className="text-gray-600">
                All file processing happens locally on your device. Your resume and personal data never touch our servers.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="text-blue-600 text-2xl mb-3">🤖</div>
              <h3 className="font-semibold text-lg mb-2">Multiple AI Providers</h3>
              <p className="text-gray-600">
                Choose from OpenAI, Claude, Gemini, Groq, or run models locally with Ollama.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="text-purple-600 text-2xl mb-3">📄</div>
              <h3 className="font-semibold text-lg mb-2">Multiple File Formats</h3>
              <p className="text-gray-600">
                Upload your resume in PDF, Markdown, or DOCX format for analysis.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="text-orange-600 text-2xl mb-3">🎯</div>
              <h3 className="font-semibold text-lg mb-2">Personalized Insights</h3>
              <p className="text-gray-600">
                Get tailored career recommendations based on your unique background and interests.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Commitment */}
        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h2 className="text-2xl font-semibold text-green-900 mb-4">Privacy Commitment</h2>
          <div className="space-y-3 text-green-800">
            <p className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>No data collection - your files are processed entirely on your device</span>
            </p>
            <p className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>No external tracking or analytics</span>
            </p>
            <p className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>API keys stored locally in your browser only</span>
            </p>
            <p className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Open source - inspect the code yourself</span>
            </p>
          </div>
        </div>

        {/* Technology */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Built With</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="font-medium text-gray-900">Next.js</div>
              <div className="text-sm text-gray-600">Frontend Framework</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="font-medium text-gray-900">TypeScript</div>
              <div className="text-sm text-gray-600">Type Safety</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="font-medium text-gray-900">Tailwind CSS</div>
              <div className="text-sm text-gray-600">Styling</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="font-medium text-gray-900">React Flow</div>
              <div className="text-sm text-gray-600">Visualization</div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gray-50 rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Get In Touch</h2>
          <div className="flex justify-center space-x-8">
            <a
              href="https://github.com/michael-borck/career-compass"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub Project</span>
            </a>
            <a
              href="https://github.com/michael-borck"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>@michael-borck</span>
            </a>
            <a
              href="https://x.com/Michael_Borck"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>@Michael_Borck</span>
            </a>
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-gray-500 text-sm">
          <p>Career Compass v0.1.0 - Privacy-first career exploration</p>
          <p className="mt-1">Made with ❤️ for career explorers worldwide</p>
        </div>

      </div>
    </div>
  );
}