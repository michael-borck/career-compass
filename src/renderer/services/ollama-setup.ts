// Guided local-AI setup: probe for a running Ollama, pull a starter model
// with live progress (streamed NDJSON from /api/pull over the streaming IPC),
// and write the connected settings. Used by the home-page setup card.
//
// Deliberately does NOT install the Ollama service itself — that needs admin
// rights and is exactly the kind of opaque system mutation the security
// audit removed. The user clicks through to the official download instead.

import { settingsStore } from '@/lib/settings-store';

export const OLLAMA_BASE = 'http://localhost:11434';
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

// Small enough to download on a whim, capable enough for every feature.
export const RECOMMENDED_MODEL = 'llama3.2:3b';
export const RECOMMENDED_MODEL_SIZE = '2.0 GB';

export type OllamaStatus = { running: false; models: [] } | { running: true; models: string[] };

export async function checkOllama(): Promise<OllamaStatus> {
  try {
    const resp = await window.electronAPI.apiFetch({
      url: `${OLLAMA_BASE}/api/tags`,
      method: 'GET',
      timeoutMs: 3000,
    });
    if (!resp.ok) return { running: false, models: [] };
    const data = JSON.parse(resp.body) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

export type PullProgress = {
  // 0-100 within the layer currently downloading, null while Ollama is in a
  // non-quantified phase (manifest, verifying, writing).
  percent: number | null;
  status: string;
};

// Pulls a model via Ollama's streaming /api/pull. Progress lines are NDJSON:
//   {"status":"pulling manifest"}
//   {"status":"pulling <digest>","total":N,"completed":M}   (repeated)
//   {"status":"verifying sha256 digest"} ... {"status":"success"}
// Rejects if the stream reports an error or never reaches success.
export async function pullModel(
  model: string,
  onProgress: (progress: PullProgress) => void
): Promise<void> {
  let buffer = '';
  let succeeded = false;
  let streamError: string | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let data: { status?: string; error?: string; total?: number; completed?: number };
    try {
      data = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (data.error) {
      streamError = data.error;
      return;
    }
    if (data.status === 'success') succeeded = true;
    const percent =
      typeof data.total === 'number' && data.total > 0 && typeof data.completed === 'number'
        ? Math.min(100, Math.round((data.completed / data.total) * 100))
        : null;
    onProgress({ percent, status: data.status ?? '' });
  };

  const resp = await window.electronAPI.apiFetchStream(
    {
      url: `${OLLAMA_BASE}/api/pull`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
      // No timeoutMs: a multi-GB pull legitimately takes as long as it takes.
    },
    (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
  );
  if (buffer.trim()) handleLine(buffer);

  if (!resp.ok) throw new Error(`Ollama pull failed: ${resp.status} ${resp.body}`.trim());
  if (streamError) throw new Error(`Ollama pull failed: ${streamError}`);
  if (!succeeded) throw new Error('Ollama pull ended without confirming success.');
}

// Writes the connected configuration: Ollama as provider with the given
// model. Other settings (search engine etc.) are preserved.
export async function connectOllama(model: string): Promise<void> {
  const current = await settingsStore.get();
  await settingsStore.set({
    ...current,
    provider: 'ollama',
    baseURL: `${OLLAMA_BASE}/v1`,
    model,
  });
}
