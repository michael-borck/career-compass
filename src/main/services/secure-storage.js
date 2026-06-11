// @ts-check
// API-key storage: encrypt with Electron's safeStorage, persist in
// electron-store, with a plaintext fallback when OS encryption is unavailable.
//
// Extracted from the ipcMain handlers in index.js so the encryption logic —
// including the electron-store Buffer-serialization quirk — is testable
// without the Electron runtime. Every function takes `store` and `safeStorage`
// so secure-storage.test.js can inject fakes (safeStorage only exists inside
// Electron; electron-store needs a userData dir).
//
// Keys are namespaced: `secure-<service>` (encrypted) or `insecure-<service>`
// (plaintext fallback).

/**
 * @typedef {{ get: (key: string, defaultValue?: unknown) => unknown,
 *             set: (key: string, value: unknown) => void,
 *             delete: (key: string) => void }} KeyStore
 * @typedef {{ isEncryptionAvailable: () => boolean,
 *             encryptString: (plain: string) => Buffer,
 *             decryptString: (encrypted: Buffer) => string,
 *             getSelectedStorageBackend?: () => string }} SafeStorageLike
 */

/**
 * @param {KeyStore} store
 * @param {SafeStorageLike} safeStorage
 * @param {string} service
 * @param {string} password
 */
function setPassword(store, safeStorage, service, password) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(password);
      store.set(`secure-${service}`, encrypted);
      return true;
    }
    // Fallback to regular store if encryption not available.
    console.warn('Encryption not available, storing password in plain text');
    store.set(`insecure-${service}`, password);
    return false;
  } catch (error) {
    console.error('Failed to store password:', error);
    throw error;
  }
}

/**
 * @param {KeyStore} store
 * @param {SafeStorageLike} safeStorage
 * @param {string} service
 */
function getPassword(store, safeStorage, service) {
  try {
    // First try encrypted storage. electron-store may hand back a Buffer or
    // its JSON-serialized form — shape-checked below, hence `any`.
    const encrypted = /** @type {any} */ (store.get(`secure-${service}`));
    if (encrypted && safeStorage.isEncryptionAvailable()) {
      // electron-store deserializes Buffer as { type: 'Buffer', data: [...] };
      // convert back to a real Buffer before decrypting.
      let buf = encrypted;
      if (encrypted && encrypted.type === 'Buffer' && Array.isArray(encrypted.data)) {
        buf = Buffer.from(encrypted.data);
      } else if (!(encrypted instanceof Buffer)) {
        buf = Buffer.from(encrypted);
      }
      return safeStorage.decryptString(buf);
    }

    // Fallback to insecure storage.
    return store.get(`insecure-${service}`, null);
  } catch (error) {
    console.error('Failed to retrieve password:', error);
    return null;
  }
}

// Reports how API keys will actually be protected on this machine. On Linux,
// Chromium's basic_text backend reports isEncryptionAvailable() === true but
// "encrypts" with a hardcoded key — obfuscation, not protection — so the
// selected backend matters, not just availability.
/**
 * @param {SafeStorageLike} safeStorage
 * @param {string} [platform]
 */
function getStorageStatus(safeStorage, platform = process.platform) {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  let backend;
  if (platform === 'darwin') {
    backend = 'keychain';
  } else if (platform === 'win32') {
    backend = 'dpapi';
  } else if (typeof safeStorage.getSelectedStorageBackend === 'function') {
    backend = safeStorage.getSelectedStorageBackend();
  } else {
    backend = 'unknown';
  }
  return {
    secure: encryptionAvailable && backend !== 'basic_text',
    encryptionAvailable,
    backend,
  };
}

/**
 * @param {KeyStore} store
 * @param {string} service
 */
function deletePassword(store, service) {
  try {
    store.delete(`secure-${service}`);
    store.delete(`insecure-${service}`);
  } catch (error) {
    console.error('Failed to delete password:', error);
    throw error;
  }
}

module.exports = { setPassword, getPassword, deletePassword, getStorageStatus };
