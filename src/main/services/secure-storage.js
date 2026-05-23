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

function getPassword(store, safeStorage, service) {
  try {
    // First try encrypted storage.
    const encrypted = store.get(`secure-${service}`);
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

function deletePassword(store, service) {
  try {
    store.delete(`secure-${service}`);
    store.delete(`insecure-${service}`);
  } catch (error) {
    console.error('Failed to delete password:', error);
    throw error;
  }
}

module.exports = { setPassword, getPassword, deletePassword };
