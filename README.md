<a href="https://github.com/michael-borck/career-compass">
  <h1 align="center">🧭 Career Compass</h1>
</a>

<p align="center">
  <strong>Privacy-first career exploration powered by AI</strong><br>
  Your data stays on your device. Your future stays in your hands.
</p>

<p align="center">
  <a href="https://github.com/michael-borck/career-compass/releases/latest">
    <img src="https://img.shields.io/github/v/release/michael-borck/career-compass?style=for-the-badge" alt="Latest Release">
  </a>
  <a href="https://github.com/michael-borck/career-compass/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/michael-borck/career-compass/release.yml?style=for-the-badge" alt="Build Status">
  </a>
  <a href="https://github.com/michael-borck/career-compass/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/michael-borck/career-compass?style=for-the-badge" alt="License">
  </a>
</p>

<p align="center">
  <a href="#-features"><strong>Features</strong></a> ·
  <a href="#-download"><strong>Download</strong></a> ·
  <a href="#-quick-start"><strong>Quick Start</strong></a> ·
  <a href="#️-development"><strong>Development</strong></a>
</p>

---

## 🌟 What is Career Compass?

Career Compass is a **privacy-first desktop application** that helps you explore career paths based on your skills, interests, and experience. Unlike online career tools, **all processing happens locally on your device** - your resume and personal data never leave your computer.

### 🔒 Privacy-First Philosophy

- **Local Processing**: All file analysis happens on your device
- **No Data Collection**: We don't collect, store, or transmit your personal information
- **Secure Storage**: API keys are encrypted and stored locally using OS-native secure storage
- **No Tracking**: Zero analytics, cookies, or external tracking

## ✨ Features

### 🤖 Multiple AI Providers
Choose from multiple AI providers or run models locally:
- **OpenAI** (GPT models)
- **Anthropic Claude** 
- **Google Gemini**
- **Groq** (fast inference)
- **Ollama** (fully local, privacy-first)

### 📄 File Upload Support
Upload your resume in multiple formats:
- **PDF** documents
- **Microsoft Word** (.docx)
- **Markdown** files

### 🔧 Configurable Settings
- Environment variable support for API keys
- Persistent settings across app restarts
- Connection testing for all providers
- Model management (especially for Ollama)

### 🎯 Career Exploration
- Personalized career recommendations
- Skills analysis and mapping
- Interactive career path visualization
- Based on your actual experience and interests

## 📥 Download

Download the latest version for your operating system:

### [📦 Latest Release](https://github.com/michael-borck/career-compass/releases/latest)

| Platform | Download | Notes |
|----------|----------|-------|
| **Windows** | `Career-Compass-Setup-{version}.exe` | NSIS installer for Windows 10+ |
| **macOS** | `Career-Compass-{version}-{arch}.dmg` | Universal build (Intel & Apple Silicon) |
| **Linux** | `Career-Compass-{version}-x64.AppImage` | Portable application |

### System Requirements

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.14 or later
- **Linux**: Most modern distributions (Ubuntu 18.04+, etc.)

## 🚀 Quick Start

1. **Download** the appropriate installer for your platform
2. **Install** the application:
   - **Windows**: Run the `.exe` installer
   - **macOS**: Open the `.dmg` and drag to Applications
   - **Linux**: Make the `.AppImage` executable and run it
3. **Configure** your AI provider in Settings
4. **Upload** your resume and start exploring!

### First-Time Setup

1. Open Career Compass
2. Go to **Settings** → **AI Provider Configuration**
3. Choose your preferred AI provider:
   - For **privacy**: Use Ollama (local, no API key needed)
   - For **convenience**: Use OpenAI, Claude, or others (API key required)
4. Test your connection
5. Return to the main page and upload your resume

## 🛠️ Development

### Prerequisites

- **Node.js** 18+ 
- **npm** or **yarn**
- **Git**

### Local Development

```bash
# Clone the repository
git clone https://github.com/michael-borck/career-compass.git
cd career-compass

# Install dependencies
npm install

# Start the development server
npm run dev

# In another terminal, start Electron
npm run electron:dev
```

### Build for Production

```bash
# Build the Next.js app
npm run build

# Package for current platform
npm run electron:pack

# Build distributables for all platforms
npm run electron:dist
```

### Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Desktop**: Electron with secure IPC
- **Styling**: Tailwind CSS
- **Visualization**: React Flow
- **File Processing**: PDF-parse, Mammoth (DOCX)
- **AI Integration**: OpenAI SDK (compatible with multiple providers)
- **Storage**: electron-store with OS-native secure storage

## 📋 Roadmap

### Current Focus
- [x] Multi-provider AI support
- [x] Local file processing
- [x] Secure settings persistence
- [x] Cross-platform releases

### Future Enhancements
- [ ] Enhanced file format support (image OCR)
- [ ] Multi-language support
- [ ] Advanced career path visualization
- [ ] Skills gap analysis
- [ ] Resume improvement suggestions
- [ ] Export career plans (PDF, Word)
- [ ] Dark mode theme
- [ ] Plugin system for custom algorithms

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure privacy-first principles are maintained

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Career Compass is forked from and inspired by [ExploreCareers](https://github.com/Nutlope/explorecareers) by Hassan El Mghari and Youssef Hasboun. This version has been enhanced for:

- **Privacy-first architecture** with local processing
- **Desktop application** with secure storage
- **Multiple AI providers** including local options
- **Cross-platform distribution** with automated releases

## 🔗 Links

- **Homepage**: [github.com/michael-borck/career-compass](https://github.com/michael-borck/career-compass)
- **Releases**: [Releases Page](https://github.com/michael-borck/career-compass/releases)
- **Issues**: [Bug Reports & Feature Requests](https://github.com/michael-borck/career-compass/issues)
- **Discussions**: [GitHub Discussions](https://github.com/michael-borck/career-compass/discussions)

---

<p align="center">
  Made with ❤️ for career explorers worldwide<br>
  <strong>Your privacy. Your data. Your future.</strong>
</p>