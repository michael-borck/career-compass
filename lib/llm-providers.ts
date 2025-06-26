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
export function getLLMConfig(): LLMConfig {
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    const savedSettings = localStorage.getItem('career-compass-settings');
    if (savedSettings) {
      try {
        const userSettings = JSON.parse(savedSettings);
        return {
          provider: userSettings.provider,
          model: userSettings.model,
          apiKey: userSettings.apiKey,
          baseURL: userSettings.baseURL,
        };
      } catch (error) {
        console.warn('Failed to parse user settings, falling back to defaults');
      }
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