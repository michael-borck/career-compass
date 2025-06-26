const { app, BrowserWindow, Menu, shell, dialog, ipcMain, safeStorage } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Import electron-store - only available in Electron context
let Store;
try {
  const ElectronStore = require('electron-store');
  // Handle both CommonJS and ES6 module exports
  Store = ElectronStore.default || ElectronStore;
  console.log('electron-store loaded successfully, constructor type:', typeof Store);
} catch (error) {
  console.error('Failed to load electron-store:', error);
}
// Only require electron-updater in production builds
let autoUpdater;
if (!isDev) {
  autoUpdater = require('electron-updater').autoUpdater;
}

// Keep a global reference of the window object
let mainWindow;

// Initialize electron-store
let store;
if (Store) {
  try {
    store = new Store({
      name: 'career-compass-settings',
      cwd: app.getPath('userData'), // Explicitly set to user data directory
      defaults: {
        settings: {
          provider: 'ollama',
          apiKey: '',
          baseURL: 'http://localhost:11434/v1',
          model: 'llama3.1:8b'
        }
      }
    });
    console.log('Store initialized at:', store.path);
  } catch (error) {
    console.error('Failed to initialize store:', error);
    store = createFallbackStore();
  }
} else {
  console.warn('electron-store not available, using fallback');
  store = createFallbackStore();
}

function createFallbackStore() {
  return {
    get: (key, defaultValue) => {
      console.log('Fallback store: getting', key, 'returning default:', defaultValue);
      return defaultValue;
    },
    set: (key, value) => {
      console.log('Fallback store: would set', key, 'to', value);
    },
    delete: (key) => {
      console.log('Fallback store: would delete', key);
    },
    clear: () => {
      console.log('Fallback store: would clear all');
    }
  };
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../public/icon.png'), // We'll create this
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle app updates (in production)
  if (!isDev && autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'Career Compass',
      submenu: [
        {
          label: 'About Career Compass',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Career Compass',
              message: 'Career Compass',
              detail: 'Privacy-first career exploration powered by AI\n\nVersion: ' + app.getVersion(),
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              window.location.hash = '/settings';
            `);
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              window.location.hash = '/';
            `);
          }
        },
        {
          label: 'Explore Careers',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              window.location.hash = '/careers';
            `);
          }
        },
        {
          label: 'About',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              window.location.hash = '/about';
            `);
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/michael-borck/career-compass');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/michael-borck/career-compass/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Auto-updater events (for production)
if (!isDev && autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available.');
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.');
  });

  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater. ' + err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    autoUpdater.quitAndInstall();
  });
}

// IPC handlers for settings store
ipcMain.handle('store-get', (event, key, defaultValue) => {
  const result = store.get(key, defaultValue);
  console.log('Store GET:', key, 'defaultValue:', defaultValue, '→', result);
  console.log('Store file path:', store.path);
  console.log('Store all data:', store.store);
  return result;
});

ipcMain.handle('store-set', (event, key, value) => {
  console.log('Store SET:', key, '←', value);
  store.set(key, value);
  // Verify it was saved
  const saved = store.get(key);
  console.log('Store VERIFY:', key, '→', saved);
});

ipcMain.handle('store-delete', (event, key) => {
  console.log('Store DELETE:', key);
  store.delete(key);
});

ipcMain.handle('store-clear', (event) => {
  console.log('Store CLEAR: all data');
  store.clear();
});

// IPC handlers for secure storage (API keys)
ipcMain.handle('secure-set-password', async (event, service, password) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(password);
      store.set(`secure-${service}`, encrypted);
      return true;
    } else {
      // Fallback to regular store if encryption not available
      console.warn('Encryption not available, storing password in plain text');
      store.set(`insecure-${service}`, password);
      return false;
    }
  } catch (error) {
    console.error('Failed to store password:', error);
    throw error;
  }
});

ipcMain.handle('secure-get-password', async (event, service) => {
  try {
    // First try encrypted storage
    const encrypted = store.get(`secure-${service}`);
    if (encrypted && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(encrypted);
    }
    
    // Fallback to insecure storage
    return store.get(`insecure-${service}`, null);
  } catch (error) {
    console.error('Failed to retrieve password:', error);
    return null;
  }
});

ipcMain.handle('secure-delete-password', async (event, service) => {
  try {
    store.delete(`secure-${service}`);
    store.delete(`insecure-${service}`);
  } catch (error) {
    console.error('Failed to delete password:', error);
    throw error;
  }
});

// IPC handlers for model management
ipcMain.handle('get-ollama-models', async (event, baseURL) => {
  try {
    const url = baseURL || 'http://localhost:11434';
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Failed to fetch Ollama models:', error);
    throw error;
  }
});

ipcMain.handle('test-connection', async (event, provider, config) => {
  try {
    // Get API key from environment if not provided in config
    let apiKey = config.apiKey;
    if (!apiKey) {
      const envVarMap = {
        openai: 'OPENAI_API_KEY',
        claude: 'ANTHROPIC_API_KEY',
        groq: 'GROQ_API_KEY',
        gemini: 'GOOGLE_API_KEY'
      };
      if (envVarMap[provider]) {
        apiKey = process.env[envVarMap[provider]];
      }
    }

    // Connection test based on provider
    switch (provider) {
      case 'ollama':
        const ollamaUrl = config.baseURL || 'http://localhost:11434';
        const ollamaResponse = await fetch(`${ollamaUrl}/api/tags`);
        return { 
          success: ollamaResponse.ok, 
          error: ollamaResponse.ok ? null : `Ollama not reachable at ${ollamaUrl}` 
        };
      
      case 'openai':
        if (!apiKey) {
          return { success: false, error: 'API key required (set OPENAI_API_KEY or enter in settings)' };
        }
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          return { success: false, error: `OpenAI API error: ${openaiResponse.status} ${errorText}` };
        }
        return { success: true, error: null };
      
      case 'claude':
        if (!apiKey) {
          return { success: false, error: 'API key required (set ANTHROPIC_API_KEY or enter in settings)' };
        }
        // Anthropic doesn't have a simple health endpoint, so we'll test with a minimal request
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          })
        });
        if (!claudeResponse.ok) {
          const errorText = await claudeResponse.text();
          return { success: false, error: `Claude API error: ${claudeResponse.status}` };
        }
        return { success: true, error: null };
      
      case 'groq':
        if (!apiKey) {
          return { success: false, error: 'API key required (set GROQ_API_KEY or enter in settings)' };
        }
        const groqResponse = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!groqResponse.ok) {
          const errorText = await groqResponse.text();
          return { success: false, error: `Groq API error: ${groqResponse.status}` };
        }
        return { success: true, error: null };
      
      case 'gemini':
        if (!apiKey) {
          return { success: false, error: 'API key required (set GOOGLE_API_KEY or enter in settings)' };
        }
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          return { success: false, error: `Gemini API error: ${geminiResponse.status}` };
        }
        return { success: true, error: null };
      
      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App info handlers
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-env-var', (event, varName) => {
  return process.env[varName] || null;
});