import { describe, it, expect } from 'vitest';
import { PROVIDERS } from './providers';

// This registry is the single source of truth consumed by BOTH llm.ts (chat)
// and providers.js (model listing / connection testing). These assertions pin
// the facts that previously drifted between the two.

describe('PROVIDERS registry', () => {
  it('covers exactly the seven providers', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(
      ['claude', 'custom', 'gemini', 'groq', 'ollama', 'openai', 'openrouter'].sort()
    );
  });

  it('maps each provider to its env var (the fact that drifted on openrouter)', () => {
    expect(PROVIDERS.openai.envVar).toBe('OPENAI_API_KEY');
    expect(PROVIDERS.claude.envVar).toBe('ANTHROPIC_API_KEY');
    expect(PROVIDERS.groq.envVar).toBe('GROQ_API_KEY');
    expect(PROVIDERS.gemini.envVar).toBe('GOOGLE_API_KEY');
    expect(PROVIDERS.openrouter.envVar).toBe('OPENROUTER_API_KEY');
  });

  it('has no env var for the keyless providers', () => {
    expect(PROVIDERS.ollama.envVar).toBeNull();
    expect(PROVIDERS.custom.envVar).toBeNull();
  });

  it('keeps the labels llm.ts surfaces in errors (claude reads "Anthropic")', () => {
    expect(PROVIDERS.claude.label).toBe('Anthropic');
    expect(PROVIDERS.openrouter.label).toBe('OpenRouter');
  });

  it('holds the OpenAI-compatible default base URLs', () => {
    expect(PROVIDERS.openai.defaultBaseURL).toBe('https://api.openai.com/v1');
    expect(PROVIDERS.groq.defaultBaseURL).toBe('https://api.groq.com/openai/v1');
    expect(PROVIDERS.openrouter.defaultBaseURL).toBe('https://openrouter.ai/api/v1');
    expect(PROVIDERS.ollama.defaultBaseURL).toBe('http://localhost:11434/v1');
    // claude/gemini use bespoke per-operation URLs, not this field.
    expect(PROVIDERS.claude.defaultBaseURL).toBeNull();
    expect(PROVIDERS.gemini.defaultBaseURL).toBeNull();
  });
});
