import { settingsStore, secureStorage } from '@/lib/settings-store';
import type { LLMConfig } from '@/lib/llm-providers';

const ENV_VAR_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/**
 * Loads the current LLMConfig from settings + secure storage, falling back
 * to environment variables exposed via electronAPI.
 */
export async function loadLLMConfig(): Promise<LLMConfig> {
  const saved = await settingsStore.get();
  let apiKey = await secureStorage.getApiKey(saved.provider);

  if (!apiKey && typeof window !== 'undefined' && (window as any).electronAPI) {
    const envVar = ENV_VAR_MAP[saved.provider];
    if (envVar) {
      apiKey =
        (await (window as any).electronAPI.getEnvVar(envVar)) || '';
    }
  }

  return {
    provider: saved.provider,
    model: saved.model,
    apiKey: apiKey || '',
    baseURL: saved.baseURL,
  };
}

/**
 * Returns true if the user has configured a provider and model.
 */
export async function isLLMConfigured(): Promise<boolean> {
  try {
    const saved = await settingsStore.get();
    return !!(saved.model && saved.model.trim());
  } catch {
    return false;
  }
}
