// Settings store for desktop persistence using electron-store
export type SearchEngine =
  | 'disabled'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'serper'
  | 'searxng';

export interface SettingsConfig {
  provider: 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini' | 'openrouter' | 'custom';
  apiKey: string;
  baseURL: string;
  model: string;
  searchEngine: SearchEngine;
  searchUrl: string;
}

export interface ModelInfo {
  name: string;
  size: string;
  modified: string;
}

// Default settings
export const DEFAULT_SETTINGS: SettingsConfig = {
  provider: 'ollama',
  apiKey: '',
  baseURL: 'http://localhost:11434/v1',
  model: '',
  searchEngine: 'duckduckgo',
  searchUrl: '',
};

// Settings store interface for both web and desktop
export interface SettingsStore {
  get(): Promise<SettingsConfig>;
  set(settings: SettingsConfig): Promise<void>;
  clear(): Promise<void>;
}

// Web fallback using localStorage
class WebSettingsStore implements SettingsStore {
  private key = 'career-compass-settings';

  async get(): Promise<SettingsConfig> {
    try {
      const saved = localStorage.getItem(this.key);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  }

  async set(settings: SettingsConfig): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
}

// Electron store for desktop
class ElectronSettingsStore implements SettingsStore {
  private store: any;

  constructor() {
    // Dynamically import electron-store to avoid errors in web context
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      this.store = (window as any).electronAPI.store;
    }
  }

  async get(): Promise<SettingsConfig> {
    if (!this.store) return DEFAULT_SETTINGS;
    
    try {
      const settings = await this.store.get('settings', DEFAULT_SETTINGS);
      console.log('ElectronSettingsStore loaded:', settings);
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.warn('Failed to load settings from electron-store:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async set(settings: SettingsConfig): Promise<void> {
    if (!this.store) {
      console.warn('Electron store not available, falling back to localStorage');
      return;
    }

    try {
      await this.store.set('settings', settings);
      console.log('ElectronSettingsStore saved:', settings);
    } catch (error) {
      console.error('Failed to save settings to electron-store:', error);
    }
  }

  async clear(): Promise<void> {
    if (this.store) {
      await this.store.clear();
    }
  }
}

// Create the appropriate store based on environment
function createSettingsStore(): SettingsStore {
  // Check if we're in Electron environment
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return new ElectronSettingsStore();
  }
  
  // Fallback to web storage
  return new WebSettingsStore();
}

// Export singleton instance
export const settingsStore = createSettingsStore();

// Secure storage interface for API keys
export interface SecureStorage {
  // Generic namespaced primitives
  getKey(namespace: string, id: string): Promise<string | null>;
  setKey(namespace: string, id: string, value: string): Promise<void>;
  deleteKey(namespace: string, id: string): Promise<void>;
  // Back-compat wrappers for LLM provider keys
  setApiKey(provider: string, apiKey: string): Promise<void>;
  getApiKey(provider: string): Promise<string | null>;
  deleteApiKey(provider: string): Promise<void>;
  // Search engine key wrappers
  getSearchApiKey(engine: SearchEngine): Promise<string | null>;
  setSearchApiKey(engine: SearchEngine, key: string): Promise<void>;
}

class ElectronSecureStorage implements SecureStorage {
  async getKey(namespace: string, id: string): Promise<string | null> {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.secureStorage) {
      return null;
    }
    const keyName = `career-compass-${namespace}-${id}`;
    try {
      const result = await (window as any).electronAPI.secureStorage.getPassword(keyName);
      if (result) return result;
    } catch {
      // ignore
    }
    // Migration fallback: older installs stored LLM keys without the namespace.
    if (namespace === 'llm') {
      const legacyKeyName = `career-compass-${id}`;
      try {
        const legacy = await (window as any).electronAPI.secureStorage.getPassword(legacyKeyName);
        if (legacy) return legacy;
      } catch {
        // ignore
      }
    }
    return null;
  }

  async setKey(namespace: string, id: string, value: string): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.secureStorage) return;
    const keyName = `career-compass-${namespace}-${id}`;
    await (window as any).electronAPI.secureStorage.setPassword(keyName, value);
  }

  async deleteKey(namespace: string, id: string): Promise<void> {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.secureStorage) return;
    const keyName = `career-compass-${namespace}-${id}`;
    await (window as any).electronAPI.secureStorage.deletePassword(keyName);
  }

  // Back-compat wrappers for LLM provider keys
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    return this.setKey('llm', provider, apiKey);
  }

  async getApiKey(provider: string): Promise<string | null> {
    return this.getKey('llm', provider);
  }

  async deleteApiKey(provider: string): Promise<void> {
    return this.deleteKey('llm', provider);
  }

  // Search engine key wrappers
  async getSearchApiKey(engine: SearchEngine): Promise<string | null> {
    return this.getKey('search', engine);
  }

  async setSearchApiKey(engine: SearchEngine, key: string): Promise<void> {
    return this.setKey('search', engine, key);
  }
}

// Web fallback (not secure, but functional for development)
class WebSecureStorage implements SecureStorage {
  async getKey(namespace: string, id: string): Promise<string | null> {
    // Migration fallback for LLM keys stored without namespace
    if (namespace === 'llm') {
      const legacy = localStorage.getItem(`career-compass-key-${id}`);
      if (legacy) return legacy;
    }
    return localStorage.getItem(`career-compass-key-${namespace}-${id}`);
  }

  async setKey(namespace: string, id: string, value: string): Promise<void> {
    localStorage.setItem(`career-compass-key-${namespace}-${id}`, value);
  }

  async deleteKey(namespace: string, id: string): Promise<void> {
    localStorage.removeItem(`career-compass-key-${namespace}-${id}`);
  }

  // Back-compat wrappers for LLM provider keys
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    return this.setKey('llm', provider, apiKey);
  }

  async getApiKey(provider: string): Promise<string | null> {
    return this.getKey('llm', provider);
  }

  async deleteApiKey(provider: string): Promise<void> {
    return this.deleteKey('llm', provider);
  }

  // Search engine key wrappers
  async getSearchApiKey(engine: SearchEngine): Promise<string | null> {
    return this.getKey('search', engine);
  }

  async setSearchApiKey(engine: SearchEngine, key: string): Promise<void> {
    return this.setKey('search', engine, key);
  }
}

export const secureStorage: SecureStorage =
  typeof window !== 'undefined' && (window as any).electronAPI?.secureStorage
    ? new ElectronSecureStorage()
    : new WebSecureStorage();