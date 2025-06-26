const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the electron-store and safeStorage APIs safely
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings store operations
  store: {
    get: (key, defaultValue) => ipcRenderer.invoke('store-get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key),
    clear: () => ipcRenderer.invoke('store-clear')
  },

  // Secure storage for API keys
  secureStorage: {
    setPassword: (service, password) => ipcRenderer.invoke('secure-set-password', service, password),
    getPassword: (service) => ipcRenderer.invoke('secure-get-password', service),
    deletePassword: (service) => ipcRenderer.invoke('secure-delete-password', service)
  },

  // Model management
  models: {
    getOllamaModels: (baseURL) => ipcRenderer.invoke('get-ollama-models', baseURL),
    testConnection: (provider, config) => ipcRenderer.invoke('test-connection', provider, config)
  },

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPlatform: () => process.platform,
  getEnvVar: (varName) => ipcRenderer.invoke('get-env-var', varName)
});