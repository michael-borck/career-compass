// Settings store for desktop persistence using electron-store
export interface SettingsConfig {
  provider: 'ollama' | 'openai' | 'claude' | 'groq' | 'gemini';
  apiKey: string;
  baseURL: string;
  model: string;
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
  model: 'llama3.1:8b'
};

// Settings store interface for both web and desktop
export interface SettingsStore {
  get(): SettingsConfig;
  set(settings: SettingsConfig): void;
  clear(): void;
}

// Web fallback using localStorage
class WebSettingsStore implements SettingsStore {
  private key = 'career-compass-settings';

  get(): SettingsConfig {
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

  set(settings: SettingsConfig): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  clear(): void {
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

  get(): SettingsConfig {
    if (!this.store) return DEFAULT_SETTINGS;
    
    try {
      const settings = this.store.get('settings', DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.warn('Failed to load settings from electron-store:', error);
      return DEFAULT_SETTINGS;
    }
  }

  set(settings: SettingsConfig): void {
    if (!this.store) {
      console.warn('Electron store not available, falling back to localStorage');
      return;
    }

    try {
      this.store.set('settings', settings);
    } catch (error) {
      console.error('Failed to save settings to electron-store:', error);
    }
  }

  clear(): void {
    if (this.store) {
      this.store.delete('settings');
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
  setApiKey(provider: string, apiKey: string): Promise<void>;
  getApiKey(provider: string): Promise<string | null>;
  deleteApiKey(provider: string): Promise<void>;
}

class ElectronSecureStorage implements SecureStorage {
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.secureStorage) {
      await (window as any).electronAPI.secureStorage.setPassword(`career-compass-${provider}`, apiKey);
    }
  }

  async getApiKey(provider: string): Promise<string | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.secureStorage) {
      return await (window as any).electronAPI.secureStorage.getPassword(`career-compass-${provider}`);
    }
    return null;
  }

  async deleteApiKey(provider: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.secureStorage) {
      await (window as any).electronAPI.secureStorage.deletePassword(`career-compass-${provider}`);
    }
  }
}

// Web fallback (not secure, but functional for development)
class WebSecureStorage implements SecureStorage {
  async setApiKey(provider: string, apiKey: string): Promise<void> {
    // In web context, store in localStorage (not actually secure)
    localStorage.setItem(`career-compass-key-${provider}`, apiKey);
  }

  async getApiKey(provider: string): Promise<string | null> {
    return localStorage.getItem(`career-compass-key-${provider}`);
  }

  async deleteApiKey(provider: string): Promise<void> {
    localStorage.removeItem(`career-compass-key-${provider}`);
  }
}

export const secureStorage: SecureStorage = 
  typeof window !== 'undefined' && (window as any).electronAPI?.secureStorage
    ? new ElectronSecureStorage()
    : new WebSecureStorage();