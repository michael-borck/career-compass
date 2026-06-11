// @vitest-environment jsdom
//
// lib/settings-store picks its backend from window.electronAPI at module
// load, so the mock is installed via vi.hoisted — before any import runs.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { api } = vi.hoisted(() => {
  const api = {
    store: {
      get: vi.fn(async (_key: string, defaultValue?: unknown) => defaultValue),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    },
    secureStorage: {
      getPassword: vi.fn(async () => null),
      setPassword: vi.fn(async () => {}),
      deletePassword: vi.fn(async () => {}),
      getStorageStatus: vi.fn(async () => ({
        secure: true,
        encryptionAvailable: true,
        backend: 'keychain',
      })),
    },
    models: {
      getOllamaModels: vi.fn(async () => []),
      getProviderModels: vi.fn(async () => []),
      testConnection: vi.fn(async () => ({ success: true, error: null })),
    },
    getVersion: vi.fn(async () => '0.0.0-test'),
    getPlatform: () => 'darwin',
    getEnvVar: vi.fn(async () => null),
  };
  (globalThis as { window?: unknown }).window ??= globalThis;
  (globalThis as any).window.electronAPI = api;
  return { api };
});

import Settings from './Settings';

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

beforeEach(() => {
  api.secureStorage.getStorageStatus.mockResolvedValue({
    secure: true,
    encryptionAvailable: true,
    backend: 'keychain',
  });
});

describe('Settings page', () => {
  it('renders and loads the saved settings', async () => {
    renderSettings();
    expect(screen.getByText('Settings')).toBeTruthy();
    // Appears as both the section heading and the select label.
    expect(screen.getAllByText('AI provider').length).toBeGreaterThan(0);
    await waitFor(() => expect(api.store.get).toHaveBeenCalled());
  });

  it('shows no key-storage warning on a secure system', async () => {
    renderSettings();
    await waitFor(() => expect(api.secureStorage.getStorageStatus).toHaveBeenCalled());
    expect(screen.queryByText(/Key storage warning/)).toBeNull();
  });

  it('warns when the keyring backend is weak (Linux basic_text)', async () => {
    api.secureStorage.getStorageStatus.mockResolvedValue({
      secure: false,
      encryptionAvailable: true,
      backend: 'basic_text',
    });
    renderSettings();
    await waitFor(() => expect(screen.getByText(/Key storage warning/)).toBeTruthy());
    expect(screen.getByText(/weak, reversible protection/)).toBeTruthy();
  });

  it('warns about plaintext storage when encryption is unavailable', async () => {
    api.secureStorage.getStorageStatus.mockResolvedValue({
      secure: false,
      encryptionAvailable: false,
      backend: 'unknown',
    });
    renderSettings();
    await waitFor(() => expect(screen.getByText(/stored in plain text/)).toBeTruthy());
  });
});
