// @ts-check
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the electron-store and safeStorage APIs safely
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings store operations
  store: {
    /** @param {string} key @param {unknown} [defaultValue] */
    get: (key, defaultValue) => ipcRenderer.invoke('store-get', key, defaultValue),
    /** @param {string} key @param {unknown} value */
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    /** @param {string} key */
    delete: (key) => ipcRenderer.invoke('store-delete', key),
    clear: () => ipcRenderer.invoke('store-clear'),
  },

  // Secure storage for API keys
  secureStorage: {
    /** @param {string} service @param {string} password */
    setPassword: (service, password) =>
      ipcRenderer.invoke('secure-set-password', service, password),
    /** @param {string} service */
    getPassword: (service) => ipcRenderer.invoke('secure-get-password', service),
    /** @param {string} service */
    deletePassword: (service) => ipcRenderer.invoke('secure-delete-password', service),
    getStorageStatus: () => ipcRenderer.invoke('secure-get-storage-status'),
  },

  // Model management
  models: {
    /** @param {string} baseURL */
    getOllamaModels: (baseURL) => ipcRenderer.invoke('get-ollama-models', baseURL),
    /** @param {string} provider @param {object} config */
    getProviderModels: (provider, config) =>
      ipcRenderer.invoke('get-provider-models', provider, config),
    /** @param {string} provider @param {object} config */
    testConnection: (provider, config) => ipcRenderer.invoke('test-connection', provider, config),
  },

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPlatform: () => process.platform,
  /** @param {string} varName */
  getEnvVar: (varName) => ipcRenderer.invoke('get-env-var', varName),

  // Generic HTTP fetch proxy (bypasses CORS)
  /** @param {object} args */
  apiFetch: (args) => ipcRenderer.invoke('api:fetch', args),

  // Streaming fetch: onChunk receives UTF-8 text pieces of a 2xx body; the
  // returned promise resolves with the final status once the stream ends.
  /**
   * @param {object} args
   * @param {(text: string) => void} onChunk
   */
  apiFetchStream: (args, onChunk) => {
    const streamId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = `api:stream:${streamId}`;
    /** @param {unknown} _event @param {string} text */
    const listener = (_event, text) => onChunk(text);
    ipcRenderer.on(channel, listener);
    return ipcRenderer.invoke('api:fetchStream', { ...args, streamId }).finally(() => {
      ipcRenderer.removeListener(channel, listener);
    });
  },

  // File parsing
  /** @param {Uint8Array} fileBytes */
  parsePdf: (fileBytes) => ipcRenderer.invoke('files:parsePdf', fileBytes),
  /** @param {Uint8Array} fileBytes */
  parseDocx: (fileBytes) => ipcRenderer.invoke('files:parseDocx', fileBytes),
});
