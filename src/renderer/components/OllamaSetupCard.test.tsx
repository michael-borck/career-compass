// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { svc } = vi.hoisted(() => ({
  svc: {
    checkOllama: vi.fn(),
    pullModel: vi.fn(),
    connectOllama: vi.fn(async () => {}),
  },
}));
vi.mock('../services/ollama-setup', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/ollama-setup')>();
  return { ...original, ...svc };
});

import OllamaSetupCard from './OllamaSetupCard';

function renderCard(onConnected = vi.fn()) {
  render(
    <MemoryRouter>
      <OllamaSetupCard onConnected={onConnected} />
    </MemoryRouter>
  );
  return onConnected;
}

beforeEach(() => {
  svc.checkOllama.mockReset();
  svc.pullModel.mockReset();
  svc.connectOllama.mockReset().mockResolvedValue(undefined);
});

describe('OllamaSetupCard', () => {
  it('offers the official download when Ollama is absent, with a re-check', async () => {
    svc.checkOllama.mockResolvedValue({ running: false, models: [] });
    renderCard();
    expect(await screen.findByText('Get Ollama (free)')).toBeTruthy();
    expect(screen.getByText(/check again/)).toBeTruthy();
    // Cloud escape hatch is always present.
    expect(screen.getByText('Set one up in Settings')).toBeTruthy();
  });

  it('offers the one-click model download when Ollama runs without models', async () => {
    svc.checkOllama.mockResolvedValue({ running: true, models: [] });
    renderCard();
    expect(await screen.findByText(/Download llama3\.2:3b · 2\.0 GB/)).toBeTruthy();
  });

  it('pulls with live progress, connects, and reports back', async () => {
    svc.checkOllama.mockResolvedValue({ running: true, models: [] });
    svc.pullModel.mockImplementation(
      async (
        _model: string,
        onProgress: (p: { percent: number | null; status: string }) => void
      ) => {
        onProgress({ percent: 42, status: 'pulling abc' });
      }
    );
    const onConnected = renderCard();
    fireEvent.click(await screen.findByText(/Download llama3\.2:3b/));
    await waitFor(() => expect(svc.connectOllama).toHaveBeenCalledWith('llama3.2:3b'));
    expect(onConnected).toHaveBeenCalled();
  });

  it('auto-connects to the first model when Ollama already has one', async () => {
    svc.checkOllama.mockResolvedValue({ running: true, models: ['qwen2:7b'] });
    const onConnected = renderCard();
    await waitFor(() => expect(svc.connectOllama).toHaveBeenCalledWith('qwen2:7b'));
    expect(onConnected).toHaveBeenCalled();
  });

  it('returns to the download offer when a pull fails', async () => {
    svc.checkOllama.mockResolvedValue({ running: true, models: [] });
    svc.pullModel.mockRejectedValue(new Error('disk full'));
    renderCard();
    fireEvent.click(await screen.findByText(/Download llama3\.2:3b/));
    expect(await screen.findByText(/Download llama3\.2:3b · 2\.0 GB/)).toBeTruthy();
  });
});
