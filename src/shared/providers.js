// Shared provider registry — the single source of truth for the per-provider
// facts that BOTH the renderer's chat() client (src/renderer/services/llm.ts)
// and the main process's provider module (src/main/services/providers.js) need.
//
// Pure data, no node/dom deps. Authored as CommonJS so the Electron main
// process can require() it directly (main runs raw .js, no build step) and Vite
// can still bundle it for the renderer; JSDoc gives TypeScript consumers types.
//
// Only cross-cutting facts live here:
//   - label:          human name used in messages
//   - envVar:         API-key environment variable (null = no key needed)
//   - defaultBaseURL: OpenAI-compatible base (null = provider has a bespoke URL)
//
// Per-operation request/response shapes — a chat completion vs a model list vs
// a connection test — stay in their respective modules; only the facts that
// were drifting between the two (the env-var map drifted on openrouter) live
// here so they can't diverge again.
//
// @typedef {'ollama'|'openai'|'claude'|'groq'|'gemini'|'openrouter'|'custom'} Provider
// @typedef {{ label: string, envVar: string | null, defaultBaseURL: string | null }} ProviderDescriptor

/** @type {Record<Provider, ProviderDescriptor>} */
const PROVIDERS = {
  ollama: { label: 'Ollama', envVar: null, defaultBaseURL: 'http://localhost:11434/v1' },
  openai: { label: 'OpenAI', envVar: 'OPENAI_API_KEY', defaultBaseURL: 'https://api.openai.com/v1' },
  claude: { label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', defaultBaseURL: null },
  groq: { label: 'Groq', envVar: 'GROQ_API_KEY', defaultBaseURL: 'https://api.groq.com/openai/v1' },
  gemini: { label: 'Gemini', envVar: 'GOOGLE_API_KEY', defaultBaseURL: null },
  openrouter: { label: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', defaultBaseURL: 'https://openrouter.ai/api/v1' },
  custom: { label: 'Custom', envVar: null, defaultBaseURL: null },
};

module.exports = { PROVIDERS };
