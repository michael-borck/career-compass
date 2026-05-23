// @vitest-environment jsdom
//
// useNavigate, react-hot-toast, and isConfigured are mocked so the hook runs
// without a real router / DOM toaster / settings.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// vi.hoisted: these are referenced by the hoisted vi.mock factories below, so
// they must be created before them.
const { navigate, toastFn, isConfigured } = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastFn: Object.assign(vi.fn(), { error: vi.fn() }),
  isConfigured: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => ({ default: toastFn }));
vi.mock('../services/llm', () => ({ isConfigured: () => isConfigured() }));

import { useGeneration } from './useGeneration';

beforeEach(() => {
  navigate.mockReset();
  toastFn.mockReset();
  toastFn.error.mockReset();
  isConfigured.mockReset();
});

function setup<T>(opts: Partial<Parameters<typeof useGeneration<T>>[0]> & { generate: () => Promise<T> }) {
  const persist = vi.fn();
  const out = renderHook(() => useGeneration<T>({ persist, ...opts }));
  return { ...out, persist };
}

describe('useGeneration.run', () => {
  it('gates on configuration: toasts and routes to /settings, never calls generate', async () => {
    isConfigured.mockResolvedValue(false);
    const generate = vi.fn().mockResolvedValue({});
    const { result } = setup({ generate });
    await act(async () => { await result.current.run(); });
    expect(toastFn.error).toHaveBeenCalledWith('Set up an LLM provider first.');
    expect(navigate).toHaveBeenCalledWith('/settings');
    expect(generate).not.toHaveBeenCalled();
  });

  it('on success: persists the result and toggles loading', async () => {
    isConfigured.mockResolvedValue(true);
    const generate = vi.fn().mockResolvedValue({ value: 42 });
    const { result, persist } = setup({ generate });
    await act(async () => { await result.current.run(); });
    expect(persist).toHaveBeenCalledWith({ value: 42 });
    expect(result.current.loading).toBe(false);
  });

  it('shows the trimmed notice only when trimmed() is true', async () => {
    isConfigured.mockResolvedValue(true);
    const { result } = setup({
      generate: () => Promise.resolve({ trimmed: true }),
      trimmed: (r: { trimmed: boolean }) => r.trimmed,
    });
    await act(async () => { await result.current.run(); });
    expect(toastFn).toHaveBeenCalledWith('Input was trimmed to fit the model.', { icon: 'ℹ️' });
  });

  it('on error: toasts the error message and resets loading', async () => {
    isConfigured.mockResolvedValue(true);
    const { result } = setup({ generate: () => Promise.reject(new Error('boom')) });
    await act(async () => { await result.current.run(); });
    expect(toastFn.error).toHaveBeenCalledWith('boom');
    expect(result.current.loading).toBe(false);
  });

  it('falls back to errorFallback when the error has no message', async () => {
    isConfigured.mockResolvedValue(true);
    const { result } = setup({
      generate: () => Promise.reject('weird'),
      errorFallback: 'Generation failed',
    });
    await act(async () => { await result.current.run(); });
    expect(toastFn.error).toHaveBeenCalledWith('Generation failed');
  });
});

describe('useGeneration auto-run', () => {
  it('runs once on mount when autoRun() is true', async () => {
    isConfigured.mockResolvedValue(true);
    const generate = vi.fn().mockResolvedValue({});
    setup({ generate, autoRun: () => true });
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  });

  it('does not run on mount when autoRun() is false', async () => {
    isConfigured.mockResolvedValue(true);
    const generate = vi.fn().mockResolvedValue({});
    setup({ generate, autoRun: () => false });
    // give any stray effect a tick
    await act(async () => { await Promise.resolve(); });
    expect(generate).not.toHaveBeenCalled();
  });
});
