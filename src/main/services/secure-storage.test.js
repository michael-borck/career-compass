// Tests for secure-storage — encrypt/decrypt + the electron-store Buffer quirk.
//
// Injects a fake electron-store and a fake safeStorage (neither exists in a
// plain Node vitest process). The fake "encrypts" by prefixing "enc:" so we
// can assert round-trips and key namespacing without real OS crypto.

import { describe, it, expect, vi } from 'vitest';
import { setPassword, getPassword, deletePassword } from './secure-storage.js';

function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    get: vi.fn((k, def) => (k in data ? data[k] : def ?? undefined)),
    set: vi.fn((k, v) => { data[k] = v; }),
    delete: vi.fn((k) => { delete data[k]; }),
    _data: data,
  };
}

function makeSafeStorage({ available = true } = {}) {
  return {
    isEncryptionAvailable: vi.fn(() => available),
    encryptString: vi.fn((s) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((buf) => Buffer.from(buf).toString('utf-8').replace(/^enc:/, '')),
  };
}

describe('setPassword', () => {
  it('encrypts and stores under secure-<service>, returns true', () => {
    const store = makeStore();
    const ss = makeSafeStorage({ available: true });
    expect(setPassword(store, ss, 'llm-openai', 'sk-123')).toBe(true);
    expect(ss.encryptString).toHaveBeenCalledWith('sk-123');
    expect(store.set).toHaveBeenCalledWith('secure-llm-openai', Buffer.from('enc:sk-123'));
  });

  it('falls back to plaintext insecure-<service> when encryption is unavailable, returns false', () => {
    const store = makeStore();
    const ss = makeSafeStorage({ available: false });
    expect(setPassword(store, ss, 'llm-openai', 'sk-123')).toBe(false);
    expect(ss.encryptString).not.toHaveBeenCalled();
    expect(store.set).toHaveBeenCalledWith('insecure-llm-openai', 'sk-123');
  });

  it('rethrows if encryption throws', () => {
    const store = makeStore();
    const ss = makeSafeStorage({ available: true });
    ss.encryptString.mockImplementation(() => { throw new Error('crypto boom'); });
    expect(() => setPassword(store, ss, 's', 'p')).toThrow('crypto boom');
  });
});

describe('getPassword', () => {
  it('round-trips a real Buffer from secure storage', () => {
    const store = makeStore({ 'secure-llm-openai': Buffer.from('enc:sk-123') });
    const ss = makeSafeStorage({ available: true });
    expect(getPassword(store, ss, 'llm-openai')).toBe('sk-123');
  });

  it('rehydrates electron-store\'s { type: "Buffer", data } serialization', () => {
    const serialized = { type: 'Buffer', data: Array.from(Buffer.from('enc:sk-xyz')) };
    const store = makeStore({ 'secure-llm-openai': serialized });
    const ss = makeSafeStorage({ available: true });
    expect(getPassword(store, ss, 'llm-openai')).toBe('sk-xyz');
  });

  it('falls back to insecure storage when there is no encrypted value', () => {
    const store = makeStore({ 'insecure-llm-openai': 'plain-key' });
    const ss = makeSafeStorage({ available: true });
    expect(getPassword(store, ss, 'llm-openai')).toBe('plain-key');
  });

  it('falls back to insecure storage when encryption is unavailable', () => {
    const store = makeStore({ 'secure-llm-openai': Buffer.from('enc:x'), 'insecure-llm-openai': 'plain' });
    const ss = makeSafeStorage({ available: false });
    expect(getPassword(store, ss, 'llm-openai')).toBe('plain');
  });

  it('returns null (never throws) when decryption fails', () => {
    const store = makeStore({ 'secure-llm-openai': Buffer.from('enc:x') });
    const ss = makeSafeStorage({ available: true });
    ss.decryptString.mockImplementation(() => { throw new Error('bad key'); });
    expect(getPassword(store, ss, 'llm-openai')).toBeNull();
  });
});

describe('deletePassword', () => {
  it('removes both the secure and insecure keys', () => {
    const store = makeStore({ 'secure-s': 'a', 'insecure-s': 'b' });
    deletePassword(store, 's');
    expect(store.delete).toHaveBeenCalledWith('secure-s');
    expect(store.delete).toHaveBeenCalledWith('insecure-s');
  });
});
