import OpenAI from 'openai';

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini';
  apiKey?: string;
  baseURL?: string;
  model: string;
}

export interface LLMProvider {
  createCompletion(messages: any[], config: LLMConfig): Promise<string>;
}

class OllamaProvider implements LLMProvider {
  async createCompletion(messages: any[], config: LLMConfig): Promise<string> {
    const baseURL = config.baseURL || 'http://localhost:11434/v1';
    const client = new OpenAI({
      baseURL,
      apiKey: 'ollama', // Ollama doesn't require real API key
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
    });

    return completion.choices[0].message.content || '';
  }
}

class OpenAIProvider implements LLMProvider {
  async createCompletion(messages: any[], config: LLMConfig): Promise<string> {
    const client = new OpenAI({
      apiKey: config.apiKey,
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
    });

    return completion.choices[0].message.content || '';
  }
}

class ClaudeProvider implements LLMProvider {
  async createCompletion(messages: any[], config: LLMConfig): Promise<string> {
    const client = new OpenAI({
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: config.apiKey,
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
    });

    return completion.choices[0].message.content || '';
  }
}

class GroqProvider implements LLMProvider {
  async createCompletion(messages: any[], config: LLMConfig): Promise<string> {
    const client = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: config.apiKey,
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
    });

    return completion.choices[0].message.content || '';
  }
}

class GeminiProvider implements LLMProvider {
  async createCompletion(messages: any[], config: LLMConfig): Promise<string> {
    const client = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: config.apiKey,
    });

    const completion = await client.chat.completions.create({
      model: config.model,
      messages,
    });

    return completion.choices[0].message.content || '';
  }
}

export const LLMProviders = {
  ollama: new OllamaProvider(),
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
  groq: new GroqProvider(),
  gemini: new GeminiProvider(),
};

export const DefaultModels = {
  ollama: 'llama3.1:8b',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-haiku-20240307',
  groq: 'llama-3.1-70b-versatile',
  gemini: 'gemini-1.5-flash',
};

export function getLLMProvider(config: LLMConfig): LLMProvider {
  return LLMProviders[config.provider];
}

// Helper function to get LLM config from user settings or environment
export async function getLLMConfig(): Promise<LLMConfig> {
  // Check if we're in browser environment and have access to settings store
  if (typeof window !== 'undefined') {
    try {
      // Import settings store dynamically to avoid SSR issues
      const { settingsStore, secureStorage } = await import('./settings-store');
      
      const settings = settingsStore.get();
      const apiKey = await secureStorage.getApiKey(settings.provider);
      
      return {
        provider: settings.provider,
        model: settings.model,
        apiKey: apiKey || '',
        baseURL: settings.baseURL,
      };
    } catch (error) {
      console.warn('Failed to load settings from store, falling back to defaults:', error);
    }
  }

  // Fallback to environment variables for server-side or missing settings
  const envProvider = process.env.LLM_PROVIDER as LLMConfig['provider'];
  const envModel = process.env.LLM_MODEL;
  const envApiKey = process.env.LLM_API_KEY;
  const envBaseURL = process.env.LLM_BASE_URL;

  // Default to Ollama for privacy-first approach
  return {
    provider: envProvider || 'ollama',
    model: envModel || DefaultModels[envProvider || 'ollama'],
    apiKey: envApiKey,
    baseURL: envBaseURL || 'http://localhost:11434/v1',
  };
}