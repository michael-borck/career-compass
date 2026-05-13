// Global types for window.electronAPI exposed by src/main/preload.js.
// All existing IPC bridges plus the new Phase 2 additions.

export type ApiFetchArgs = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown> | unknown[];
};

export type ApiFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  body: string;
};

declare global {
  interface Window {
    electronAPI: {
      // Settings store (electron-store with safeStorage encryption)
      store: {
        get: <T = unknown>(key: string, defaultValue?: T) => Promise<T>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
        clear: () => Promise<void>;
      };

      // OS-encrypted secure storage for API keys
      secureStorage: {
        setPassword: (service: string, password: string) => Promise<void>;
        getPassword: (service: string) => Promise<string | null>;
        deletePassword: (service: string) => Promise<void>;
      };

      // Provider model listing and connection tests
      models: {
        getOllamaModels: (baseURL: string) => Promise<string[]>;
        getProviderModels: (
          provider: string,
          config: { apiKey?: string; baseURL?: string }
        ) => Promise<string[]>;
        testConnection: (
          provider: string,
          config: { apiKey?: string; baseURL?: string; model?: string }
        ) => Promise<{ success: boolean; error: string | null }>;
      };

      // App info
      getVersion: () => Promise<string>;
      getPlatform: () => string;
      getEnvVar: (name: string) => Promise<string | null>;

      // Phase 2 additions
      apiFetch: (args: ApiFetchArgs) => Promise<ApiFetchResponse>;
    };
  }
}

export {};
