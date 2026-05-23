const { app, BrowserWindow, Menu, shell, dialog, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { apiFetch } = require('./services/api-fetch');
const { parsePdf, parseDocx } = require('./services/file-processors');
const { getOllamaModels, listModels, testConnection } = require('./services/providers');
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
// Only require electron-updater in production builds. Wrapped in try/catch
// because a corrupted install (e.g. electron-updater shipped without its
// out/ dir) would otherwise throw at module load and crash the app before
// any window appears. Auto-update is non-essential — degrade to "no updates"
// rather than bricking startup. All autoUpdater usages guard on truthiness.
let autoUpdater;
if (!isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (error) {
    console.error('Failed to load electron-updater; auto-update disabled:', error);
  }
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
          model: ''
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
    icon: path.join(__dirname, '../../assets/icon.png'),
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
    ? 'http://localhost:5180'
    : `file://${path.join(__dirname, '../../dist/index.html')}`;
  
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

// Generic HTTP fetch proxy (bypasses CORS via main process)
ipcMain.handle('api:fetch', async (event, args) => apiFetch(args));

// File parsing — renderer ships file bytes as a Uint8Array (structured-cloned
// across IPC); we convert to a Node Buffer here for pdf-parse / mammoth.
ipcMain.handle('files:parsePdf', async (event, fileBytes) => {
  const buf = Buffer.from(fileBytes);
  return parsePdf(buf);
});

ipcMain.handle('files:parseDocx', async (event, fileBytes) => {
  const buf = Buffer.from(fileBytes);
  return parseDocx(buf);
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
      // electron-store deserializes Buffer as {type:'Buffer', data:[...]}
      // Convert back to a real Buffer before decrypting
      let buf = encrypted;
      if (encrypted && encrypted.type === 'Buffer' && Array.isArray(encrypted.data)) {
        buf = Buffer.from(encrypted.data);
      } else if (!(encrypted instanceof Buffer)) {
        buf = Buffer.from(encrypted);
      }
      return safeStorage.decryptString(buf);
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
ipcMain.handle('get-ollama-models', (event, baseURL) => getOllamaModels(baseURL));

// Fetch available models from any provider
ipcMain.handle('get-provider-models', (event, provider, config) =>
  listModels(provider, config)
);

ipcMain.handle('test-connection', (event, provider, config) =>
  testConnection(provider, config)
);

// App info handlers
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-env-var', (event, varName) => {
  return process.env[varName] || null;
});