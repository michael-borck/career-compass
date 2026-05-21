import { test, expect } from '@playwright/test';
import { launchCareerCompass } from './helpers';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// These tests exercise the IPC bridge end-to-end inside the packaged-style
// Electron runtime — the paths the renderer smoke walkthrough can't reach:
// electron-store persistence, safeStorage encryption, the api:fetch proxy,
// and pdf/docx parsing in the main process.

const FIXTURES = path.resolve(__dirname, '..', 'src/main/services/__fixtures__');

let server: http.Server;
let serverUrl: string;

test.beforeAll(async () => {
  // Local server so the apiFetch test is deterministic and offline.
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path: req.url, method: req.method }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('settings store + secure storage persist and clear via IPC', async () => {
  const { app, window } = await launchCareerCompass();
  try {
    const result = await window.evaluate(async () => {
      const api = (window as any).electronAPI;

      // electron-store round-trip
      await api.store.set('e2e-probe', { hello: 'world', n: 42 });
      const stored = await api.store.get('e2e-probe');
      await api.store.delete('e2e-probe');
      const afterDelete = await api.store.get('e2e-probe', 'MISSING');

      // safeStorage (OS keychain) round-trip
      await api.secureStorage.setPassword('e2e-openai', 'sk-secret-123');
      const secret = await api.secureStorage.getPassword('e2e-openai');
      await api.secureStorage.deletePassword('e2e-openai');
      const secretAfterDelete = await api.secureStorage.getPassword('e2e-openai');

      const version = await api.getVersion();

      return { stored, afterDelete, secret, secretAfterDelete, version };
    });

    expect(result.stored).toEqual({ hello: 'world', n: 42 });
    expect(result.afterDelete).toBe('MISSING');
    expect(result.secret).toBe('sk-secret-123');
    expect(result.secretAfterDelete).toBeNull();
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  } finally {
    await app.close();
  }
});

test('apiFetch proxies an HTTP request through the main process', async () => {
  const { app, window } = await launchCareerCompass();
  try {
    const res = await window.evaluate(async (url) => {
      const api = (window as any).electronAPI;
      return api.apiFetch({ url: `${url}/zen`, method: 'GET' });
    }, serverUrl);

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.path).toBe('/zen');
    expect(body.method).toBe('GET');
  } finally {
    await app.close();
  }
});

test('parsePdf and parseDocx extract text from real files over IPC', async () => {
  const pdfBytes = Array.from(readFileSync(path.join(FIXTURES, 'sample.pdf')));
  const docxBytes = Array.from(readFileSync(path.join(FIXTURES, 'sample.docx')));

  const { app, window } = await launchCareerCompass();
  try {
    const result = await window.evaluate(
      async ({ pdf, docx }) => {
        const api = (window as any).electronAPI;
        const pdfText = await api.parsePdf(new Uint8Array(pdf));
        const docxText = await api.parseDocx(new Uint8Array(docx));
        return { pdfText, docxText };
      },
      { pdf: pdfBytes, docx: docxBytes }
    );

    expect(typeof result.pdfText).toBe('string');
    expect(result.pdfText.length).toBeGreaterThan(0);
    expect(typeof result.docxText).toBe('string');
    expect(result.docxText.length).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});
