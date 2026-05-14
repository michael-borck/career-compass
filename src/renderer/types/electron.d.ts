// Global types for window.electronAPI exposed by src/main/preload.js.
// All existing IPC bridges plus the new Phase 2 additions.

export type ApiFetchArgs = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown> | unknown[];
  // Per-request timeout in milliseconds. When set, the main-process
  // apiFetch aborts the underlying Electron net.request after this many
  // ms and rejects with "Request timed out after <ms>ms". Omit for no
  // timeout (default behavior — discouraged; prefer a value).
  timeoutMs?: number;
};

export type ApiFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  body: string;
};

export type AvailableModel = { id: string; name: string; size?: number };

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
        getOllamaModels: (baseURL: string) => Promise<Array<{ name: string; size?: number }>>;
        getProviderModels: (
          provider: string,
          config: { apiKey?: string; baseURL?: string }
        ) => Promise<AvailableModel[]>;
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
      parsePdf: (fileBytes: Uint8Array) => Promise<string>;
      parseDocx: (fileBytes: Uint8Array) => Promise<string>;
    };
  }
}

export {};
