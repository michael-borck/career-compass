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

// Environment variable mapping for each provider
const ENV_VAR_MAP = {
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  gemini: 'GOOGLE_API_KEY',
  ollama: ''
};

// Helper function to get LLM config from user settings or environment
export async function getLLMConfig(): Promise<LLMConfig> {
  // Check if we're in browser environment and have access to settings store
  if (typeof window !== 'undefined') {
    try {
      // Import settings store dynamically to avoid SSR issues
      const { settingsStore, secureStorage } = await import('./settings-store');
      
      const settings = await settingsStore.get();
      let apiKey = await secureStorage.getApiKey(settings.provider);
      
      // If no stored API key, try environment variable
      if (!apiKey && ENV_VAR_MAP[settings.provider]) {
        apiKey = process.env[ENV_VAR_MAP[settings.provider]] || '';
      }
      
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
  const envProvider = (process.env.LLM_PROVIDER as LLMConfig['provider']) || 'ollama';
  const envModel = process.env.LLM_MODEL || DefaultModels[envProvider];
  const envBaseURL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1';
  
  // Get API key from appropriate environment variable
  let envApiKey = process.env.LLM_API_KEY; // Generic fallback
  if (!envApiKey && ENV_VAR_MAP[envProvider]) {
    envApiKey = process.env[ENV_VAR_MAP[envProvider]];
  }

  // Default to Ollama for privacy-first approach
  return {
    provider: envProvider,
    model: envModel,
    apiKey: envApiKey || '',
    baseURL: envBaseURL,
  };
}